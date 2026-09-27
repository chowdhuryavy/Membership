-- Migration: Phone Book & Unified Guest Directory Table
-- Run this in your Supabase SQL Editor if you wish to persist direct phone book records into a dedicated table.

CREATE TABLE IF NOT EXISTS phonebook_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  outlet_id UUID REFERENCES outlets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  source TEXT DEFAULT 'Manual',
  category TEXT DEFAULT 'General Contact',
  nationality TEXT,
  dob DATE,
  notes TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE phonebook_contacts ENABLE ROW LEVEL SECURITY;

-- Create policy allowing all read/write operations for authenticated and anonymous app access
CREATE POLICY "Allow all operations on phonebook_contacts"
ON phonebook_contacts FOR ALL
USING (true)
WITH CHECK (true);

-- Performance Indexes for search and scope filtering
CREATE INDEX IF NOT EXISTS idx_phonebook_property ON phonebook_contacts(property_id);
CREATE INDEX IF NOT EXISTS idx_phonebook_outlet ON phonebook_contacts(outlet_id);
CREATE INDEX IF NOT EXISTS idx_phonebook_phone ON phonebook_contacts(phone);
CREATE INDEX IF NOT EXISTS idx_phonebook_name ON phonebook_contacts(name);
