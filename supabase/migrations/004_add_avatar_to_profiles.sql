-- Add avatar column to profiles table
-- Migration: 004_add_avatar_to_profiles.sql

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar TEXT;

-- Add comment for documentation
COMMENT ON COLUMN profiles.avatar IS 'Avatar preset ID or custom avatar URL';
