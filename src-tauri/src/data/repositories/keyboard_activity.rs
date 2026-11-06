use crate::data::sqlite_error::SqliteOperationError;
use crate::domain::keyboard_activity::{
    KeyboardActivitySnapshot, KeyboardComboMinute, KeyboardComboTotal, KeyboardKeyMinute,
    KeyboardKeyTotal,
};
use sqlx::{Pool, Row, Sqlite, SqliteConnection};

/// Upper bound on keys returned per snapshot. The bundled layouts define 104
/// keys for a full-size board, so this leaves room for regional variants without
/// letting a pathological dataset produce an unbounded payload.
const MAX_KEYS_PER_SNAPSHOT: usize = 256;
const MAX_COMBOS_PER_SNAPSHOT: usize = 64;

/// Applies one flushed minute of keyboard activity.
///
/// Both statements run inside a single transaction on the caller's connection so
/// the pool's single permit is held for one round trip instead of one per row.
/// Counters are additive: a retry after a transient failure re-adds the same
/// delta, which is why the caller only flushes each bucket once.
pub(crate) async fn apply_minute(
    pool: &Pool<Sqlite>,
    keys: &[KeyboardKeyMinute],
    combos: &[KeyboardComboMinute],
) -> Result<(), SqliteOperationError> {
    if keys.is_empty() && combos.is_empty() {
        return Ok(());
    }
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| SqliteOperationError::from_sqlx("writing keyboard activity", error))?;
    apply_minute_in_connection(&mut *tx, keys, combos).await?;
    tx.commit()
        .await
        .map_err(|error| SqliteOperationError::from_sqlx("committing keyboard activity", error))
}

async fn apply_minute_in_connection(
    connection: &mut SqliteConnection,
    keys: &[KeyboardKeyMinute],
    combos: &[KeyboardComboMinute],
) -> Result<(), SqliteOperationError> {
    for key in keys {
        if key.press_count <= 0 {
            continue;
        }
        sqlx::query(
            "INSERT INTO keyboard_key_minutes (bucket_start_ms, key_name, key_code, press_count)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(bucket_start_ms, key_name) DO UPDATE
             SET press_count = press_count + excluded.press_count",
        )
        .bind(key.bucket_start_ms)
        .bind(&key.key_name)
        .bind(key.key_code)
        .bind(key.press_count)
        .execute(&mut *connection)
        .await
        .map_err(|error| SqliteOperationError::from_sqlx("writing keyboard key minute", error))?;
    }
    for combo in combos {
        if combo.press_count <= 0 {
            continue;
        }
        sqlx::query(
            "INSERT INTO keyboard_combo_minutes (bucket_start_ms, combo_key, press_count)
             VALUES (?, ?, ?)
             ON CONFLICT(bucket_start_ms, combo_key) DO UPDATE
             SET press_count = press_count + excluded.press_count",
        )
        .bind(combo.bucket_start_ms)
        .bind(&combo.combo_key)
        .bind(combo.press_count)
        .execute(&mut *connection)
        .await
        .map_err(|error| SqliteOperationError::from_sqlx("writing keyboard combo minute", error))?;
    }
    Ok(())
}

/// Reads aggregated keyboard activity for a closed range, newest buckets first.
pub async fn load_snapshot(
    pool: &Pool<Sqlite>,
    range_start_ms: i64,
    range_end_ms: i64,
) -> Result<KeyboardActivitySnapshot, String> {
    if range_end_ms <= range_start_ms {
        return Ok(KeyboardActivitySnapshot {
            range_start_ms,
            range_end_ms,
            total_presses: 0,
            keys: Vec::new(),
            combos: Vec::new(),
        });
    }

    let key_rows = sqlx::query(
        "SELECT key_name, key_code, SUM(press_count) AS press_count
         FROM keyboard_key_minutes
         WHERE bucket_start_ms >= ? AND bucket_start_ms < ?
         GROUP BY key_name, key_code
         ORDER BY press_count DESC, key_name ASC
         LIMIT ?",
    )
    .bind(range_start_ms)
    .bind(range_end_ms)
    .bind(MAX_KEYS_PER_SNAPSHOT as i64)
    .fetch_all(pool)
    .await
    .map_err(|error| format!("failed to read keyboard key totals: {error}"))?;

    let keys = key_rows
        .into_iter()
        .map(|row| KeyboardKeyTotal {
            key_name: row.get("key_name"),
            key_code: row.get("key_code"),
            press_count: row.get("press_count"),
        })
        .collect::<Vec<_>>();

    let combo_rows = sqlx::query(
        "SELECT combo_key, SUM(press_count) AS press_count
         FROM keyboard_combo_minutes
         WHERE bucket_start_ms >= ? AND bucket_start_ms < ?
         GROUP BY combo_key
         ORDER BY press_count DESC, combo_key ASC
         LIMIT ?",
    )
    .bind(range_start_ms)
    .bind(range_end_ms)
    .bind(MAX_COMBOS_PER_SNAPSHOT as i64)
    .fetch_all(pool)
    .await
    .map_err(|error| format!("failed to read keyboard combo totals: {error}"))?;

    let combos = combo_rows
        .into_iter()
        .map(|row| KeyboardComboTotal {
            combo_key: row.get("combo_key"),
            press_count: row.get("press_count"),
        })
        .collect::<Vec<_>>();

    let total_presses = keys.iter().map(|key| key.press_count).sum();
    Ok(KeyboardActivitySnapshot {
        range_start_ms,
        range_end_ms,
        total_presses,
        keys,
        combos,
    })
}

/// True when the two keyboard tables exist. Callers use this to stay quiet on
/// databases that predate the migration instead of surfacing a SQL error.
pub async fn is_available(pool: &Pool<Sqlite>) -> Result<bool, String> {
    crate::data::schema_contracts::has_keyboard_activity_schema(pool).await
}

/// Deletes every recorded keyboard bucket. Used by the per-feature clear action;
/// it deliberately does not touch sessions or any other tracked data.
pub async fn clear_all(pool: &Pool<Sqlite>) -> Result<u64, String> {
    let keys = sqlx::query("DELETE FROM keyboard_key_minutes")
        .execute(pool)
        .await
        .map_err(|error| format!("failed to clear keyboard key minutes: {error}"))?
        .rows_affected();
    sqlx::query("DELETE FROM keyboard_combo_minutes")
        .execute(pool)
        .await
        .map_err(|error| format!("failed to clear keyboard combo minutes: {error}"))?;
    Ok(keys)
}

/// Drops buckets older than `cutoff_ms` so retention policy can extend to
/// keyboard data without rewriting the generic session cleanup path.
pub async fn delete_before(pool: &Pool<Sqlite>, cutoff_ms: i64) -> Result<u64, String> {
    let keys = sqlx::query("DELETE FROM keyboard_key_minutes WHERE bucket_start_ms < ?")
        .bind(cutoff_ms)
        .execute(pool)
        .await
        .map_err(|error| format!("failed to prune keyboard key minutes: {error}"))?
        .rows_affected();
    sqlx::query("DELETE FROM keyboard_combo_minutes WHERE bucket_start_ms < ?")
        .bind(cutoff_ms)
        .execute(pool)
        .await
        .map_err(|error| format!("failed to prune keyboard combo minutes: {error}"))?;
    Ok(keys)
}
