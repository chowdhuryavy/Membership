-- Migration to add outlet_id to massage_rooms table
ALTER TABLE massage_rooms ADD COLUMN IF NOT EXISTS outlet_id TEXT REFERENCES outlets(id);

-- Optional: If you want to migrate existing data, you might need a more complex script
-- but for now, this adds the column so the application can use it.
