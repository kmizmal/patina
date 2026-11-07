use crate::commands::{error::CommandErrorDto, window_guard::require_main_window};
use crate::data::repositories::keyboard_activity;
use crate::data::{sqlite_error::SqliteOperationError, sqlite_pool::wait_for_sqlite_pool};
use crate::domain::keyboard_activity::KeyboardActivitySnapshot;
use tauri::{AppHandle, Runtime, WebviewWindow};

/// Reads aggregated keyboard activity for a closed time range.
///
/// The range arrives from the renderer already computed from the active range
/// selector so the backend never reinterprets "today" or timezone boundaries.
#[tauri::command]
pub async fn cmd_get_keyboard_activity_snapshot<R: Runtime>(
    range_start_ms: i64,
    range_end_ms: i64,
    app: AppHandle<R>,
    window: WebviewWindow<R>,
) -> Result<KeyboardActivitySnapshot, CommandErrorDto> {
    require_main_window(&window)?;
    let pool = wait_for_sqlite_pool(&app)
        .await
        .map_err(|error| CommandErrorDto::new("SQLITE_UNAVAILABLE", error, true))?;
    keyboard_activity::load_snapshot(&pool, range_start_ms, range_end_ms)
        .await
        .map_err(|error| {
            SqliteOperationError::operation_failed("reading keyboard activity", error).into()
        })
}

/// Deletes every recorded keyboard bucket without touching any other tracked
/// data. The confirmation happens in the renderer before this is invoked.
#[tauri::command]
pub async fn cmd_clear_keyboard_activity<R: Runtime>(
    app: AppHandle<R>,
    window: WebviewWindow<R>,
) -> Result<u64, CommandErrorDto> {
    require_main_window(&window)?;
    let pool = wait_for_sqlite_pool(&app)
        .await
        .map_err(|error| CommandErrorDto::new("SQLITE_UNAVAILABLE", error, true))?;
    keyboard_activity::clear_all(&pool).await.map_err(|error| {
        SqliteOperationError::operation_failed("clearing keyboard activity", error).into()
    })
}
