CREATE TABLE IF NOT EXISTS keyboard_key_minutes (
    bucket_start_ms INTEGER NOT NULL,
    key_name TEXT NOT NULL CHECK(TRIM(key_name) <> ''),
    key_code INTEGER NOT NULL,
    press_count INTEGER NOT NULL CHECK(press_count > 0),
    PRIMARY KEY(bucket_start_ms, key_name)
);
CREATE INDEX IF NOT EXISTS idx_keyboard_key_minutes_range
ON keyboard_key_minutes(bucket_start_ms);

CREATE TABLE IF NOT EXISTS keyboard_combo_minutes (
    bucket_start_ms INTEGER NOT NULL,
    combo_key TEXT NOT NULL CHECK(TRIM(combo_key) <> ''),
    press_count INTEGER NOT NULL CHECK(press_count > 0),
    PRIMARY KEY(bucket_start_ms, combo_key)
);
CREATE INDEX IF NOT EXISTS idx_keyboard_combo_minutes_range
ON keyboard_combo_minutes(bucket_start_ms);
