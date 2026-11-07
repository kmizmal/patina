//! Owns the keyboard capture lifecycle.
//!
//! Placement: orchestration lives in `app/*`; all persistence goes through the
//! `data::keyboard_activity_store` adapter. The platform capture module must not
//! import `data`, and `app` must not touch the pool or repositories directly, so
//! this module is the only glue between the two.
//!
//! Timing contract, and why it is built this way:
//!
//! * Capture accumulates in memory and this task flushes **one closed minute at
//!   a time**. Keystrokes therefore never contend with the tracker's own writes
//!   for the pool's single connection, and a burst of typing cannot delay the
//!   tracking sample past its 8 s stall threshold.
//! * Capture start/stop is driven by the stored setting, not by process start,
//!   so the toggle is the single source of truth and a crashed run resumes
//!   correctly on the next launch.
//! * The supervisor re-reads the setting on a slow cadence, but the settings
//!   command applies changes immediately so the toggle feels instant.

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Runtime};
use tokio::time::Duration;

use crate::data::keyboard_activity_store;
use crate::domain::keyboard_activity::{KeyboardComboMinute, KeyboardKeyMinute};
use crate::platform::clock;
use crate::platform::windows::keyboard_capture;

/// Flush cadence. Matches the bucket size, so each flush closes exactly one
/// minute and the writer runs at most once a minute.
const FLUSH_INTERVAL: Duration = Duration::from_secs(60);
/// How often the loop re-reads the setting as a fallback for a missed event.
const SETTING_POLL_INTERVAL: Duration = Duration::from_secs(15);

/// Guards against stacked supervisors if the restart path ever runs twice.
static LOOP_SPAWNED: AtomicBool = AtomicBool::new(false);

/// One-shot wake channel so a settings change is applied without waiting for the
/// next flush tick.
static WAKE: std::sync::OnceLock<tokio::sync::Notify> = std::sync::OnceLock::new();

/// Starts the capture supervisor for this process.
///
/// Safe to call more than once: only the first call spawns the loop.
pub(crate) fn spawn_supervisor<R: Runtime + 'static>(app: AppHandle<R>) {
    if LOOP_SPAWNED.swap(true, Ordering::SeqCst) {
        return;
    }
    tauri::async_runtime::spawn(async move {
        run_supervisor(app).await;
    });
}

async fn run_supervisor<R: Runtime + 'static>(app: AppHandle<R>) {
    let mut capturing = false;
    // Flushing runs on the bucket cadence; the setting is re-read on a coarser
    // one. Counting flush ticks would never reach the poll interval because the
    // flush is the longer of the two, so the poll gets its own tick counter.
    let poll_ticks_between_flushes =
        (FLUSH_INTERVAL.as_secs() / SETTING_POLL_INTERVAL.as_secs()).max(1) as u32;
    let mut ticks_since_setting_poll = poll_ticks_between_flushes;

    loop {
        if ticks_since_setting_poll >= poll_ticks_between_flushes {
            ticks_since_setting_poll = 0;
            match keyboard_activity_store::load_enabled(&app).await {
                Ok(Some(enabled)) => capturing = apply_capture_state(enabled, capturing),
                // Pool unavailable right now: keep the current state rather than
                // toggling capture on a transient condition.
                Ok(None) => {}
                Err(error) => eprintln!("[keyboard] failed to read capture setting: {error}"),
            }
        }
        ticks_since_setting_poll += 1;

        // Flush regardless of the current capture state: whatever closed before
        // the user turned capture off is still real recorded data.
        flush_closed_bucket(&app).await;

        // Sleep until the next bucket boundary, but let a settings change wake
        // the loop early so the toggle takes effect immediately.
        let sleep_deadline = tokio::time::Instant::now() + FLUSH_INTERVAL;
        tokio::select! {
            _ = tokio::time::sleep_until(sleep_deadline) => {}
            _ = wake().notified() => {}
        }
    }
}

fn wake() -> &'static tokio::sync::Notify {
    WAKE.get_or_init(tokio::sync::Notify::new)
}

/// Applies the desired capture state, returning the resulting state.
fn apply_capture_state(enabled: bool, capturing: bool) -> bool {
    if enabled {
        if capturing {
            return true;
        }
        match keyboard_capture::start() {
            keyboard_capture::CaptureStart::Started => {
                eprintln!("[keyboard] capture started");
                true
            }
            // Already running from an earlier start that lost track of state.
            keyboard_capture::CaptureStart::AlreadyRunning => true,
            // Raw input registration failed. The feature is on but nothing is
            // being recorded, so this must be loud rather than a silent gap.
            keyboard_capture::CaptureStart::Unavailable => {
                eprintln!("[keyboard] capture unavailable: raw input registration failed");
                false
            }
        }
    } else if capturing {
        keyboard_capture::stop();
        eprintln!("[keyboard] capture stopped");
        false
    } else {
        false
    }
}

async fn flush_closed_bucket<R: Runtime>(app: &AppHandle<R>) {
    let now_ms = clock::unix_timestamp_millis_i64();
    let Some(batch) = keyboard_capture::take_closed_batch(now_ms) else {
        return;
    };
    if batch.keys.is_empty() && batch.combos.is_empty() {
        return;
    }

    let keys = batch
        .keys
        .into_iter()
        .map(|key| KeyboardKeyMinute {
            bucket_start_ms: batch.bucket_start_ms,
            key_name: key.key_name,
            key_code: key.key_code,
            press_count: key.press_count,
        })
        .collect::<Vec<_>>();
    let combos = batch
        .combos
        .into_iter()
        .map(|combo| KeyboardComboMinute {
            bucket_start_ms: batch.bucket_start_ms,
            combo_key: combo.combo_key,
            press_count: combo.press_count,
        })
        .collect::<Vec<_>>();

    if let Err(error) = keyboard_activity_store::write_minute(app, keys, combos).await {
        eprintln!("[keyboard] failed to flush keyboard activity: {error}");
    }
}

/// Applies the capture setting immediately when the user flips the toggle,
/// instead of waiting for the next poll. Called by the settings command after
/// the settings commit succeeds.
pub(crate) fn apply_setting_change(enabled: bool) {
    let capturing = apply_capture_state(enabled, keyboard_capture::is_running());
    if !enabled {
        // Turning capture off discards the in-progress bucket. Writing it would
        // mean persisting keystrokes recorded after the user asked us to stop.
        keyboard_capture::discard_open_bucket();
    } else if capturing {
        // A fresh capture starts its own minute; anything already buffered
        // belongs to the previous on-period and should be persisted now rather
        // than merged into the new one.
        wake().notify_waiters();
    }
}
