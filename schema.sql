-- MycelialCRM schema — run in Supabase SQL Editor
-- All tables use crm_ prefix to avoid conflicts

-- Contacts: one row per unique email
CREATE TABLE crm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  first_name text,
  last_name text,
  full_name text,
  company text,
  phone text,
  website text,
  bio text,
  roles jsonb DEFAULT '[]'::jsonb,
  skills jsonb DEFAULT '[]'::jsonb,
  interests jsonb DEFAULT '[]'::jsonb,
  services_needed jsonb DEFAULT '[]'::jsonb,
  business_size text,
  client_notes text,
  video_url text,
  video_transcript text,
  video_duration numeric,
  calendly_completed boolean DEFAULT false,
  sources jsonb DEFAULT '[]'::jsonb,
  tags jsonb DEFAULT '[]'::jsonb,
  last_interaction_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Full-text search vector (generated column)
ALTER TABLE crm_contacts ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(full_name, '') || ' ' ||
      coalesce(first_name, '') || ' ' ||
      coalesce(last_name, '') || ' ' ||
      coalesce(email, '') || ' ' ||
      coalesce(company, '') || ' ' ||
      coalesce(bio, '') || ' ' ||
      coalesce(video_transcript, '') || ' ' ||
      coalesce(client_notes, '')
    )
  ) STORED;

-- Indexes
CREATE INDEX idx_crm_contacts_sources ON crm_contacts USING GIN (sources);
CREATE INDEX idx_crm_contacts_tags ON crm_contacts USING GIN (tags);
CREATE INDEX idx_crm_contacts_search ON crm_contacts USING GIN (search_vector);
CREATE INDEX idx_crm_contacts_last_interaction ON crm_contacts (last_interaction_at);

-- Notes: interaction timeline
CREATE TABLE crm_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  content text NOT NULL,
  note_type text DEFAULT 'manual',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_crm_notes_contact ON crm_notes (contact_id, created_at DESC);

-- Import log: audit trail
CREATE TABLE crm_import_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text,
  file_name text,
  rows_total int DEFAULT 0,
  rows_imported int DEFAULT 0,
  rows_merged int DEFAULT 0,
  rows_skipped int DEFAULT 0,
  imported_at timestamptz DEFAULT now()
);

-- RLS policies (allow authenticated users full access — allowlist enforced in app)
ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_import_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can do everything on crm_contacts"
  ON crm_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can do everything on crm_notes"
  ON crm_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can do everything on crm_import_log"
  ON crm_import_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
