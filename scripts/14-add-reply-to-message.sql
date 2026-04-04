-- Migration: Add reply_to_message_id column for message replies
ALTER TABLE conversation_messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id uuid REFERENCES conversation_messages(id) ON DELETE SET NULL;

-- Index for efficient lookups of replies
CREATE INDEX IF NOT EXISTS idx_conversation_messages_reply_to
  ON conversation_messages(reply_to_message_id)
  WHERE reply_to_message_id IS NOT NULL;
