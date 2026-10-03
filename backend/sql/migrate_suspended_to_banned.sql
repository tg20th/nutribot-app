-- Migration: Map SUSPENDED -> BANNED (NB-65)
-- Chạy script này TRƯỚC KHI restart app

UPDATE users
SET status = N'BANNED'
WHERE status = N'SUSPENDED';
GO

PRINT 'Migration completed: SUSPENDED -> BANNED';
