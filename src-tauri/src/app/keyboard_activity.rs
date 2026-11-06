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
use tokio::time::{sleep, Duration};

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
    let mut ticks_since_setting_poll = 0u32;
    // Poll the setting on the first tick so capture follows the stored state
    // immediately at launch instead of waiting a full interval.
    let poll_ticks = (SETTING_POLL_INTERVAL.as_secs() / FLUSH_INTERVAL.as_secs()).max(1) as u32;

    loop {
        if ticks_since_setting_poll == 0 {
            match keyboard_activity_store::load_enabled(&app).await {
                Ok(Some(enabled)) => capturing = apply_capture_state(enabled, capturing),
                // Pool unavailable right now: keep the current state rather than
                // toggling capture on a transient condition.
                Ok(None) => {}
                Err(error) => eprintln!("[keyboard] failed to read capture setting: {error}"),
            }
        }
        ticks_since_setting_poll += 1;
        if ticks_since_setting_poll >= poll_ticks {
            ticks_since_setting_poll = 0;
        }

        // Flush regardless of the current capture state: whatever closed before
        // the user turned capture off is still real recorded data.
        flush_closed_bucket(&app).await;

        sleep(FLUSH_INTERVAL).await;
    }
}

/// Applies the desired capture state, returning the resulting state.
fn apply_capture_state(enabled: bool, capturing: bool) -> bool {
    if enabled {
        match keyboard_capture::start() {
            keyboard_capture::CaptureStart::Started => true,
            // Already running from an earlier start that lost track of state.
            keyboard_capture::CaptureStart::AlreadyRunning => true,
            keyboard_capture::CaptureStart::Unavailable => false,
        }
    } else if capturing {
        keyboard_capture::stop();
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
    let _ = apply_capture_state(enabled, keyboard_capture::is_running());
    if !enabled {
        // Turning capture off discards the in-progress bucket. Writing it would
        // mean persisting keystrokes recorded after the user asked us to stop.
        keyboard_capture::discard_open_bucket();
    }
}

/// Used by diagnostics and tests to read the supervisor's view of capture.
pub(crate) fn is_capturing() -> bool {
    keyboard_capture::is_running()
}
