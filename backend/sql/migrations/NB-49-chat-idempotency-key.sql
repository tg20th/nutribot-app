-- NB-49: Add idempotency_key column to chat_messages
-- Supports deduplication: retry with same key does not create duplicate message

ALTER TABLE chat_messages
ADD idempotency_key VARCHAR(100) NULL;

CREATE UNIQUE INDEX IX_chat_messages_idempotency_key
ON chat_messages(idempotency_key)
WHERE idempotency_key IS NOT NULL;
