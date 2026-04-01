-- Migration: Add Twilio Conversations API fields
-- This adds conversation_sid (Twilio Conversations SID) to the conversations table
-- and message_index to conversation_messages for Read Horizon support.

-- Add Twilio Conversations SID to conversations table
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS conversation_sid text;

-- Index for fast lookups by conversation_sid
CREATE INDEX IF NOT EXISTS idx_conversations_conversation_sid
  ON conversations (conversation_sid)
  WHERE conversation_sid IS NOT NULL;

-- Add message index (Twilio Conversations message index for Read Horizon)
ALTER TABLE conversation_messages
  ADD COLUMN IF NOT EXISTS message_index integer;
