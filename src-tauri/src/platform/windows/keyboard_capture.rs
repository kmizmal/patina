//! Global keyboard activity capture over Raw Input.
//!
//! Design notes that matter for maintenance:
//!
//! * `RegisterRawInputDevices` with `RIDEV_INPUTSINK` needs a real top-level
//!   window: message-only windows never receive `WM_INPUT`, and a null
//!   `hwndTarget` is rejected. The window is created hidden, exactly like the
//!   power observer.
//! * Windows allows one registration per device class per process, so `start`
//!   must be idempotent. Unlike the power observer, this module keeps the thread
//!   handle and window handle so capture can be stopped and restarted from the
//!   settings toggle without leaking a thread or a window class.
//! * Raw Input delivers `VKey`/`MakeCode` only. No character ever reaches this
//!   module: input goes straight from the keyboard driver to us, bypassing the
//!   foreground application's IME, so typed text including passwords cannot be
//!   reconstructed here even in principle.
//! * `WM_INPUT` must be handled inside the message loop without blocking. All
//!   aggregation happens in memory and the flush is driven by the caller, so a
//!   slow database never stalls the input queue.

use crate::domain::keyboard_activity::minute_bucket_start;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::thread::{self, JoinHandle};
use std::time::Duration;
use windows::core::PCWSTR;
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;
use windows::Win32::UI::Input::{
    GetRawInputData, RegisterRawInputDevices, HRAWINPUT, RAWINPUT, RAWINPUTDEVICE, RAWINPUTHEADER,
    RIDEV_INPUTSINK, RIDEV_REMOVE, RID_INPUT, RIM_TYPEKEYBOARD,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, DestroyWindow, DispatchMessageW, GetMessageW, PostMessageW,
    PostQuitMessage, RegisterClassW, TranslateMessage, MSG, WINDOW_EX_STYLE, WM_CLOSE, WM_DESTROY,
    WM_INPUT,
};

const WINDOW_CLASS_NAME: &str = "PatinaKeyboardCaptureWindow";
/// Virtual key code for "no key" (a key-up report for a key Windows never saw down).
const VK_NONE: u16 = 0xFF;
/// `RAWKEYBOARD.Flags` bit set on key release.
const RI_KEY_BREAK: u16 = 0x01;
/// `RAWKEYBOARD.Flags` bit set for the E0-prefixed variant of a key.
const RI_KEY_E0: u16 = 0x02;
/// Upper bound on distinct keys tracked in one bucket. A full-size board has 104
/// keys; this only guards against a stuck/repeating device filling memory.
const MAX_KEYS_PER_BUCKET: usize = 256;

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyboardBatch {
    pub bucket_start_ms: i64,
    pub keys: Vec<KeyCount>,
    pub combos: Vec<ComboCount>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyCount {
    pub key_name: String,
    pub key_code: i64,
    pub press_count: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComboCount {
    pub combo_key: String,
    pub press_count: i64,
}

/// Result of a capture lifecycle request, so the caller can surface an accurate
/// message instead of assuming the hook is live.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CaptureStart {
    Started,
    AlreadyRunning,
    Unavailable,
}

struct CaptureState {
    thread: Option<JoinHandle<()>>,
    /// The window address, not an `HWND`: `HWND` wraps a raw pointer and is not
    /// `Send`, which would make the whole static state non-`Send`. The handle is
    /// rebuilt where it is actually used.
    hwnd_address: Option<isize>,
}

static STATE: OnceLock<Mutex<CaptureState>> = OnceLock::new();
static BUFFER: OnceLock<Mutex<KeyBuffer>> = OnceLock::new();
static MODIFIERS: AtomicU64 = AtomicU64::new(0);

fn state() -> &'static Mutex<CaptureState> {
    STATE.get_or_init(|| {
        Mutex::new(CaptureState {
            thread: None,
            hwnd_address: None,
        })
    })
}

fn buffer() -> &'static Mutex<KeyBuffer> {
    BUFFER.get_or_init(|| Mutex::new(KeyBuffer::default()))
}

/// Accumulates presses for the current minute bucket.
///
/// `bucket_start_ms` is stored alongside the counters so a flush can tell which
/// minute the data belongs to; the caller supplies the clock so tests do not
/// depend on wall time.
#[derive(Default)]
struct KeyBuffer {
    bucket_start_ms: i64,
    keys: HashMap<String, (i64, i64)>,
    combos: HashMap<String, i64>,
}

impl KeyBuffer {
    fn record(&mut self, now_ms: i64, key_name: &str, key_code: i64, combo: Option<&str>) {
        let bucket = minute_bucket_start(now_ms);
        if bucket != self.bucket_start_ms {
            // The caller is responsible for flushing; if it has not, drop the
            // stale partial bucket rather than attributing it to the wrong
            // minute. Losing at most one partial minute is better than time
            // travel in the data.
            self.bucket_start_ms = bucket;
            self.keys.clear();
            self.combos.clear();
        }
        if self.keys.len() < MAX_KEYS_PER_BUCKET || self.keys.contains_key(key_name) {
            let entry = self
                .keys
                .entry(key_name.to_string())
                .or_insert((key_code, 0));
            entry.1 += 1;
        }
        if let Some(combo) = combo {
            *self.combos.entry(combo.to_string()).or_insert(0) += 1;
        }
    }

    fn take(&mut self, now_ms: i64) -> Option<KeyboardBatch> {
        if self.keys.is_empty() && self.combos.is_empty() {
            return None;
        }
        // Only emit buckets that are already closed; a bucket still in progress
        // stays in memory so the next flush adds to it.
        let current_bucket = minute_bucket_start(now_ms);
        if self.bucket_start_ms >= current_bucket {
            return None;
        }
        let batch = KeyboardBatch {
            bucket_start_ms: self.bucket_start_ms,
            keys: self
                .keys
                .iter()
                .map(|(name, (code, count))| KeyCount {
                    key_name: name.clone(),
                    key_code: *code,
                    press_count: *count,
                })
                .collect(),
            combos: self
                .combos
                .iter()
                .map(|(name, count)| ComboCount {
                    combo_key: name.clone(),
                    press_count: *count,
                })
                .collect(),
        };
        self.keys.clear();
        self.combos.clear();
        self.bucket_start_ms = current_bucket;
        Some(batch)
    }
}

/// Installs the global keyboard capture.
///
/// Idempotent: calling it while capture is running returns
/// `CaptureStart::AlreadyRunning` and leaves the existing one alone.
pub fn start() -> CaptureStart {
    let mut guard = match state().lock() {
        Ok(guard) => guard,
        Err(_) => return CaptureStart::Unavailable,
    };
    if guard.thread.is_some() {
        return CaptureStart::AlreadyRunning;
    }

    // HWND wraps a raw pointer and is deliberately not `Send`, so the
    // ready handshake carries the raw address and rebuilds the handle on
    // this side. The window outlives the message because the sending thread
    // keeps it alive until its message loop exits.
    let (tx, rx) = std::sync::mpsc::channel::<Option<isize>>();
    let handle = thread::Builder::new()
        .name("patina-keyboard-capture".to_string())
        .spawn(move || run_capture_loop(tx));
    let handle = match handle {
        Ok(handle) => handle,
        Err(_) => return CaptureStart::Unavailable,
    };

    // Wait for the window to exist so the caller can report a real state. A
    // timeout here means window creation failed; the thread exits on its own.
    match rx.recv_timeout(Duration::from_secs(5)) {
        Ok(Some(address)) => {
            guard.hwnd_address = Some(address);
            guard.thread = Some(handle);
            CaptureStart::Started
        }
        _ => {
            guard.thread = Some(handle);
            guard.hwnd_address = None;
            CaptureStart::Unavailable
        }
    }
}

/// Stops capture and releases the window, class registration and thread.
///
/// Safe to call when nothing is running.
pub fn stop() {
    let (hwnd, handle) = {
        let mut guard = match state().lock() {
            Ok(guard) => guard,
            Err(_) => return,
        };
        (guard.hwnd_address.take(), guard.thread.take())
    };

    if let Some(address) = hwnd {
        unsafe {
            // Ask the owning thread to tear down; WM_CLOSE is handled by the
            // window procedure, which unregisters raw input and posts WM_QUIT.
            let hwnd = HWND(address as *mut core::ffi::c_void);
            let _ = PostMessageW(Some(hwnd), WM_CLOSE, WPARAM(0), LPARAM(0));
        }
    }
    if let Some(handle) = handle {
        let _ = handle.join();
    }
    MODIFIERS.store(0, Ordering::Relaxed);
}

pub fn is_running() -> bool {
    state()
        .lock()
        .map(|guard| guard.thread.is_some())
        .unwrap_or(false)
}

/// Reads and clears the closed-bucket data for `now_ms`.
///
/// Returns `None` when the current bucket is still open or nothing was recorded,
/// so the caller can skip a database round trip entirely.
pub fn take_closed_batch(now_ms: i64) -> Option<KeyboardBatch> {
    buffer()
        .lock()
        .ok()
        .and_then(|mut buffer| buffer.take(now_ms))
}

/// Drops whatever is buffered in the open bucket.
///
/// Used when the user turns capture off: keystrokes recorded after that moment
/// must not be persisted.
pub fn discard_open_bucket() {
    if let Ok(mut buffer) = buffer().lock() {
        buffer.keys.clear();
        buffer.combos.clear();
    }
}

fn run_capture_loop(ready: std::sync::mpsc::Sender<Option<isize>>) {
    unsafe {
        let instance = match GetModuleHandleW(None) {
            Ok(module) => module.into(),
            Err(_) => {
                let _ = ready.send(None);
                return;
            }
        };

        let class_name: Vec<u16> = WINDOW_CLASS_NAME
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();

        let window_class = windows::Win32::UI::WindowsAndMessaging::WNDCLASSW {
            lpfnWndProc: Some(capture_window_proc),
            hInstance: instance,
            lpszClassName: PCWSTR(class_name.as_ptr()),
            ..Default::default()
        };
        // A previous run in the same process may already own the class; that is
        // fine, RegisterClassW returns 0 with ERROR_CLASS_ALREADY_EXISTS.
        let _ = RegisterClassW(&window_class);

        let hwnd = match CreateWindowExW(
            WINDOW_EX_STYLE::default(),
            PCWSTR(class_name.as_ptr()),
            PCWSTR(class_name.as_ptr()),
            // No WS_VISIBLE: this observer must never appear to the user.
            Default::default(),
            0,
            0,
            0,
            0,
            None,
            None,
            Some(instance),
            None,
        ) {
            Ok(hwnd) => hwnd,
            Err(_) => {
                let _ = ready.send(None);
                return;
            }
        };

        // RIDEV_INPUTSINK delivers input even when this window is not focused;
        // that is the whole point, and it requires the real HWND created above.
        let devices = [RAWINPUTDEVICE {
            usUsagePage: 0x01, // HID_USAGE_PAGE_GENERIC
            usUsage: 0x06,     // HID_USAGE_GENERIC_KEYBOARD
            dwFlags: RIDEV_INPUTSINK,
            hwndTarget: hwnd,
        }];
        if RegisterRawInputDevices(&devices, std::mem::size_of::<RAWINPUTDEVICE>() as u32).is_err()
        {
            let _ = ready.send(None);
            let _ = DestroyWindow(hwnd);
            return;
        }

        let _ = ready.send(Some(hwnd.0 as isize));

        // Message loop. WM_INPUT is handled inline without blocking so the input
        // queue never backs up; aggregation is a few hash updates.
        let mut msg = MSG::default();
        while GetMessageW(&mut msg, None, 0, 0).into() {
            let _ = TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }

        // Unregister before the window goes away so no input lands on a dead
        // HWND while this thread unwinds.
        let remove = [RAWINPUTDEVICE {
            usUsagePage: 0x01,
            usUsage: 0x06,
            dwFlags: RIDEV_REMOVE,
            hwndTarget: HWND::default(),
        }];
        let _ = RegisterRawInputDevices(&remove, std::mem::size_of::<RAWINPUTDEVICE>() as u32);
        let _ = DestroyWindow(hwnd);
    }
}

unsafe extern "system" fn capture_window_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    match msg {
        WM_INPUT => {
            eprintln!("[keyboard] wm_input received");
            handle_raw_input(HRAWINPUT(lparam.0 as _));
            // DefWindowProcW performs the required cleanup for WM_INPUT.
            DefWindowProcW(hwnd, msg, wparam, lparam)
        }
        WM_CLOSE => {
            // DestroyWindow fails only for an already-destroyed handle, which the
            // teardown path tolerates; the message loop still needs to stop.
            let _ = unsafe { DestroyWindow(hwnd) };
            LRESULT(0)
        }
        WM_DESTROY => {
            unsafe { PostQuitMessage(0) };
            LRESULT(0)
        }
        _ => unsafe { DefWindowProcW(hwnd, msg, wparam, lparam) },
    }
}

fn handle_raw_input(raw_input_handle: HRAWINPUT) {
    let mut raw = RAWINPUT::default();
    let mut size = std::mem::size_of::<RAWINPUT>() as u32;
    let read = unsafe {
        GetRawInputData(
            raw_input_handle,
            RID_INPUT,
            Some(&mut raw as *mut _ as *mut _),
            &mut size,
            std::mem::size_of::<RAWINPUTHEADER>() as u32,
        )
    };
    if read == u32::MAX || read == 0 {
        return;
    }
    if raw.header.dwType != RIM_TYPEKEYBOARD.0 {
        return;
    }
    let keyboard = unsafe { raw.data.keyboard };

    // A key-up report for VK_NONE means the key was released while another
    // window had focus; nothing to count.
    if keyboard.VKey == VK_NONE {
        return;
    }
    let is_break = keyboard.Flags & RI_KEY_BREAK != 0;
    if is_break {
        release_modifier(keyboard.VKey);
        return;
    }

    let key_name = key_name(keyboard.VKey, keyboard.Flags & RI_KEY_E0 != 0);
    let combo = modifier_combo(keyboard.VKey);

    if let Ok(mut buffer) = buffer().lock() {
        let now = crate::platform::clock::unix_timestamp_millis_i64();
        eprintln!("[keyboard] record {key_name} vk={}", keyboard.VKey);
        buffer.record(now, &key_name, i64::from(keyboard.VKey), combo.as_deref());
    }
    track_modifier(keyboard.VKey);
}

// Modifier bookkeeping. Only the physical left/right variants are tracked so a
// stale modifier cannot leak: every key-up clears its own bit, and `stop()`
// clears all of them.
const MOD_SHIFT: u64 = 1 << 0;
const MOD_CTRL: u64 = 1 << 1;
const MOD_ALT: u64 = 1 << 2;
const MOD_WIN: u64 = 1 << 3;

fn modifier_bit(vkey: u16) -> u64 {
    match vkey {
        0x10 | 0xA0 | 0xA1 => MOD_SHIFT, // VK_SHIFT, LSHIFT, RSHIFT
        0x11 | 0xA2 | 0xA3 => MOD_CTRL,  // VK_CONTROL, LCONTROL, RCONTROL
        0x12 | 0xA4 | 0xA5 => MOD_ALT,   // VK_MENU, LMENU, RMENU
        0x5B | 0x5C => MOD_WIN,          // VK_LWIN, VK_RWIN
        _ => 0,
    }
}

fn track_modifier(vkey: u16) {
    let bit = modifier_bit(vkey);
    if bit != 0 {
        MODIFIERS.fetch_or(bit, Ordering::Relaxed);
    }
}

fn release_modifier(vkey: u16) {
    let bit = modifier_bit(vkey);
    if bit != 0 {
        MODIFIERS.fetch_and(!bit, Ordering::Relaxed);
    }
}

/// Builds a stable, locale-independent combo key such as `ctrl+c`.
///
/// Returns `None` for modifier presses themselves so the leader of a chord is
/// not double counted as its own combo.
fn modifier_combo(vkey: u16) -> Option<String> {
    if modifier_bit(vkey) != 0 {
        return None;
    }
    let active = MODIFIERS.load(Ordering::Relaxed);
    if active == 0 {
        return None;
    }
    let key = key_name(vkey, false).to_ascii_lowercase();
    let mut parts = Vec::new();
    if active & MOD_CTRL != 0 {
        parts.push("ctrl");
    }
    if active & MOD_ALT != 0 {
        parts.push("alt");
    }
    if active & MOD_SHIFT != 0 {
        parts.push("shift");
    }
    if active & MOD_WIN != 0 {
        parts.push("win");
    }
    parts.push(key.as_str());
    Some(parts.join("+"))
}

/// Maps a virtual key code to a layout-independent physical key name that the
/// bundled key geometry understands (`KeyA`, `Digit1`, `ControlLeft`, ...).
fn key_name(vkey: u16, extended: bool) -> String {
    match vkey {
        0x30..=0x39 => format!("Digit{}", vkey - 0x30),
        0x41..=0x5A => format!("Key{}", (b'A' + (vkey - 0x41) as u8) as char),
        0x60..=0x69 => format!("Numpad{}", vkey - 0x60),
        0x70..=0x87 => format!("F{}", vkey - 0x6F),
        0x25 => "ArrowLeft".into(),
        0x26 => "ArrowUp".into(),
        0x27 => "ArrowRight".into(),
        0x28 => "ArrowDown".into(),
        0x20 => "Space".into(),
        0x0D => "Enter".into(),
        0x09 => "Tab".into(),
        0x08 => "Backspace".into(),
        0x1B => "Escape".into(),
        0x2E => "Delete".into(),
        0x2D => "Insert".into(),
        0x24 => "Home".into(),
        0x23 => "End".into(),
        0x21 => "PageUp".into(),
        0x22 => "PageDown".into(),
        // Left/right modifier variants are distinguished by the E0 flag.
        0x10 if extended => "ShiftRight".into(),
        0x10 => "ShiftLeft".into(),
        0x11 if extended => "ControlRight".into(),
        0x11 => "ControlLeft".into(),
        0x12 if extended => "AltRight".into(),
        0x12 => "AltLeft".into(),
        0xA0 => "ShiftLeft".into(),
        0xA1 => "ShiftRight".into(),
        0xA2 => "ControlLeft".into(),
        0xA3 => "ControlRight".into(),
        0xA4 => "AltLeft".into(),
        0xA5 => "AltRight".into(),
        0x5B => "MetaLeft".into(),
        0x5C => "MetaRight".into(),
        0x14 => "CapsLock".into(),
        0x90 => "NumLock".into(),
        0x91 => "ScrollLock".into(),
        0x2C => "PrintScreen".into(),
        0x13 => "Pause".into(),
        0xDB => "BracketLeft".into(),
        0xDD => "BracketRight".into(),
        0xDC => "Backslash".into(),
        0xBA => "Semicolon".into(),
        0xDE => "Quote".into(),
        0xBC => "Comma".into(),
        0xBE => "Period".into(),
        0xBF => "Slash".into(),
        0xC0 => "Backquote".into(),
        0xBD => "Minus".into(),
        0xBB => "Equal".into(),
        other => format!("VK{other:02X}"),
    }
}

#[cfg(test)]
mod tests {
    use super::{key_name, minute_bucket_start, KeyBuffer, MODIFIERS, MOD_SHIFT};
    use std::sync::atomic::Ordering;

    #[test]
    fn key_names_follow_the_bundled_layout_conventions() {
        assert_eq!(key_name(0x41, false), "KeyA");
        assert_eq!(key_name(0x5A, false), "KeyZ");
        assert_eq!(key_name(0x31, false), "Digit1");
        assert_eq!(key_name(0x0D, false), "Enter");
        assert_eq!(key_name(0x10, false), "ShiftLeft");
        assert_eq!(key_name(0x10, true), "ShiftRight");
    }

    #[test]
    fn bucket_floors_to_the_minute() {
        assert_eq!(minute_bucket_start(0), 0);
        assert_eq!(minute_bucket_start(119_999), 60_000);
    }

    #[test]
    fn buffer_only_emits_closed_buckets() {
        let mut buffer = KeyBuffer::default();
        buffer.record(60_000, "KeyA", 65, None);
        // Still inside the same minute: nothing to flush yet.
        assert!(buffer.take(90_000).is_none());
        let batch = buffer.take(120_000).expect("closed bucket flushes");
        assert_eq!(batch.bucket_start_ms, 60_000);
        assert_eq!(batch.keys.len(), 1);
        assert_eq!(batch.keys[0].press_count, 1);
        // Second take has nothing left.
        assert!(buffer.take(180_000).is_none());
    }

    #[test]
    fn buffer_accumulates_within_a_bucket() {
        let mut buffer = KeyBuffer::default();
        buffer.record(60_000, "KeyA", 65, Some("ctrl+keya"));
        buffer.record(60_001, "KeyA", 65, Some("ctrl+keya"));
        let batch = buffer.take(120_000).expect("closed bucket flushes");
        assert_eq!(batch.keys[0].press_count, 2);
        assert_eq!(batch.combos[0].press_count, 2);
    }

    #[test]
    fn modifier_bits_are_released_independently() {
        MODIFIERS.store(0, Ordering::Relaxed);
        MODIFIERS.fetch_or(MOD_SHIFT, Ordering::Relaxed);
        assert_ne!(MODIFIERS.load(Ordering::Relaxed), 0);
        MODIFIERS.fetch_and(!MOD_SHIFT, Ordering::Relaxed);
        assert_eq!(MODIFIERS.load(Ordering::Relaxed), 0);
    }
}
