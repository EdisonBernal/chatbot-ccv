-- Add delivery status to conversation messages (WhatsApp ticks state)

CREATE TYPE IF NOT EXISTS message_delivery_status AS ENUM ('sent', 'delivered', 'read');

-- Ensure the enum contains 'queued' (Twilio lifecycle: queued -> sent -> delivered -> read)
ALTER TYPE message_delivery_status ADD VALUE IF NOT EXISTS 'queued';

ALTER TABLE conversation_messages
  ADD COLUMN IF NOT EXISTS delivery_status message_delivery_status NOT NULL DEFAULT 'sent';

-- Ensure existing messages have default state
UPDATE conversation_messages
  SET delivery_status = 'sent'
  WHERE delivery_status IS NULL;
