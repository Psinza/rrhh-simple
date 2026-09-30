ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS attendance_events JSONB
  CHECK (attendance_events IS NULL OR jsonb_typeof(attendance_events) = 'array');
