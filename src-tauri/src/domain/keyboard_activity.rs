use serde::{Deserialize, Serialize};

/// Aggregated keyboard activity for one minute bucket.
///
/// Rows are keyed by minute rather than by event: a keystroke never reaches the
/// database directly, it only bumps an in-memory counter that is flushed at most
/// once per bucket. This keeps the writer far below the tracking sampling rate
/// and bounds row growth to `minutes * distinct_keys`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyboardKeyMinute {
    pub bucket_start_ms: i64,
    pub key_name: String,
    pub key_code: i64,
    pub press_count: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyboardComboMinute {
    pub bucket_start_ms: i64,
    pub combo_key: String,
    pub press_count: i64,
}

/// One key's total across a queried range.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyboardKeyTotal {
    pub key_name: String,
    pub key_code: i64,
    pub press_count: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyboardComboTotal {
    pub combo_key: String,
    pub press_count: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyboardActivitySnapshot {
    pub range_start_ms: i64,
    pub range_end_ms: i64,
    pub total_presses: i64,
    pub keys: Vec<KeyboardKeyTotal>,
    pub combos: Vec<KeyboardComboTotal>,
}

/// Aligns a timestamp down to the start of its minute.
///
/// The tracking pipeline already uses hour-floor arithmetic for read-model
/// buckets; keyboard buckets are the same idea one granularity finer. Negative
/// inputs keep the floor semantics instead of truncating toward zero.
pub fn minute_bucket_start(timestamp_ms: i64) -> i64 {
    const MINUTE_MS: i64 = 60_000;
    timestamp_ms - timestamp_ms.rem_euclid(MINUTE_MS)
}

#[cfg(test)]
mod tests {
    use super::minute_bucket_start;

    #[test]
    fn minute_bucket_floors_to_the_minute() {
        assert_eq!(minute_bucket_start(0), 0);
        assert_eq!(minute_bucket_start(59_999), 0);
        assert_eq!(minute_bucket_start(60_000), 60_000);
        assert_eq!(minute_bucket_start(1_781_614_400_123), 1_781_614_380_000);
    }

    #[test]
    fn minute_bucket_floors_negative_timestamps() {
        assert_eq!(minute_bucket_start(-1), -60_000);
        assert_eq!(minute_bucket_start(-60_000), -60_000);
    }
}
