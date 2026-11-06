use crate::data::repositories::{keyboard_activity, tracker_settings};
use crate::data::sqlite_error::SqliteOperationError;
use crate::data::sqlite_pool::{run_recoverable_sqlite_write, wait_for_sqlite_pool};
use crate::domain::keyboard_activity::{
    KeyboardActivitySnapshot, KeyboardComboMinute, KeyboardKeyMinute,
};
use tauri::{AppHandle, Runtime};

/// Reads whether keyboard capture is enabled.
///
/// Returns `Ok(None)` while the pool is unavailable (for example during a
/// restore) rather than an error: the supervisor treats "unknown" as "keep the
/// current state" instead of toggling capture on a transient condition.
pub async fn load_enabled<R: Runtime>(app: &AppHandle<R>) -> Result<Option<bool>, String> {
    let pool = match wait_for_sqlite_pool(app).await {
        Ok(pool) => pool,
        Err(_) => return Ok(None),
    };
    tracker_settings::load_keyboard_activity_enabled(&pool)
        .await
        .map(Some)
        .map_err(|error| format!("failed to read keyboard activity setting: {error}"))
}

/// Writes one closed minute of keyboard activity.
///
/// Delegates to the shared recoverable-write helper so a transiently closed pool
/// is reopened instead of dropping the bucket.
pub async fn write_minute<R: Runtime>(
    app: &AppHandle<R>,
    keys: Vec<KeyboardKeyMinute>,
    combos: Vec<KeyboardComboMinute>,
) -> Result<(), SqliteOperationError> {
    if keys.is_empty() && combos.is_empty() {
        return Ok(());
    }
    run_recoverable_sqlite_write(app, "writing keyboard activity", move |pool| {
        let keys = keys.clone();
        let combos = combos.clone();
        async move { keyboard_activity::apply_minute(&pool, &keys, &combos).await }
    })
    .await
}

pub async fn load_snapshot<R: Runtime>(
    app: &AppHandle<R>,
    range_start_ms: i64,
    range_end_ms: i64,
) -> Result<KeyboardActivitySnapshot, String> {
    let pool = wait_for_sqlite_pool(app).await?;
    keyboard_activity::load_snapshot(&pool, range_start_ms, range_end_ms).await
}

pub async fn clear_all<R: Runtime>(app: &AppHandle<R>) -> Result<u64, String> {
    let pool = wait_for_sqlite_pool(app).await?;
    keyboard_activity::clear_all(&pool).await
}

/// Reports whether the keyboard tables exist yet, so callers can present "not
/// recorded" instead of an error on a database that predates the migration.
pub async fn is_available<R: Runtime>(app: &AppHandle<R>) -> Result<bool, String> {
    let pool = wait_for_sqlite_pool(app).await?;
    keyboard_activity::is_available(&pool).await
}
