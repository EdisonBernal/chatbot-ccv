-- Migration: add 'failed' to message_delivery_status enum
-- Twilio can return: queued, sent, delivered, read, failed, undelivered
-- 'failed' and 'undelivered' both mean the message could not be delivered.

ALTER TYPE message_delivery_status ADD VALUE IF NOT EXISTS 'failed';
