-- 12-add-media-url-to-messages.sql
-- Adds media_url column to conversation_messages to support image/file attachments.

ALTER TABLE conversation_messages
  ADD COLUMN IF NOT EXISTS media_url TEXT;

COMMENT ON COLUMN conversation_messages.media_url IS 'URL of attached media (image, document, etc.)';
