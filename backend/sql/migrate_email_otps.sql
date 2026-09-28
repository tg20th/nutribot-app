-- Migration: Create email_otps table for email verification during registration
-- Required for NB-02 feature (email OTP verification)
-- Date: 2026-09-28

USE [NutriBotV2]
GO

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'email_otps')
BEGIN
    CREATE TABLE email_otps (
        otp_id         INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        email          NVARCHAR(255) NOT NULL,
        otp_code       NVARCHAR(6) NOT NULL,
        expires_at     DATETIME2(3) NOT NULL,
        is_used        BIT NOT NULL DEFAULT 0,
        created_at     DATETIME2(3) NOT NULL DEFAULT SYSUTCDATETIME(),

        CONSTRAINT CK_email_otps_otp_code CHECK (LEN(otp_code) = 6 AND otp_code NOT LIKE '%[^0-9]%')
    );

    -- Index để tìm nhanh theo email
    CREATE NONCLUSTERED INDEX IX_email_otps_email
    ON email_otps(email, expires_at, is_used)
    WHERE is_used = 0;
END
GO