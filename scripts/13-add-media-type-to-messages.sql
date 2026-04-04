-- Migration: Add media_type column to conversation_messages
-- Allows distinguishing between image, audio, video, and document attachments

ALTER TABLE conversation_messages
ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT NULL;

COMMENT ON COLUMN conversation_messages.media_type IS 'Type of media attachment: image, audio, video, document, or null for text-only messages';
