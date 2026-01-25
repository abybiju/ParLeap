-- Add CCLI number field to songs table
ALTER TABLE songs ADD COLUMN IF NOT EXISTS ccli_number TEXT;
