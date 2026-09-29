/* Merge registration OTP and pending email-change verification into email_otps. */
SET XACT_ABORT ON;
BEGIN TRY
BEGIN TRANSACTION;

IF COL_LENGTH('dbo.email_otps', 'purpose') IS NULL
    ALTER TABLE dbo.email_otps ADD purpose NVARCHAR(30) NOT NULL
        CONSTRAINT DF_email_otps_purpose DEFAULT (N'REGISTRATION');
IF COL_LENGTH('dbo.email_otps', 'otp_hash') IS NULL
    ALTER TABLE dbo.email_otps ADD otp_hash NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.email_otps', 'user_id') IS NULL
    ALTER TABLE dbo.email_otps ADD user_id INT NULL;
IF COL_LENGTH('dbo.email_otps', 'failed_attempts') IS NULL
    ALTER TABLE dbo.email_otps ADD failed_attempts TINYINT NOT NULL
        CONSTRAINT DF_email_otps_failed_attempts DEFAULT (0);

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_email_otps_otp_code')
    ALTER TABLE dbo.email_otps DROP CONSTRAINT CK_email_otps_otp_code;
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_email_otps_payload')
    ALTER TABLE dbo.email_otps DROP CONSTRAINT CK_email_otps_payload;

IF OBJECT_ID('dbo.email_change_requests', 'U') IS NOT NULL
BEGIN
    INSERT INTO dbo.email_otps (email, otp_hash, purpose, user_id, failed_attempts,
                                expires_at, is_used, created_at)
    SELECT e.pending_email, e.otp_hash, N'EMAIL_CHANGE', e.user_id, e.failed_attempts,
           e.expires_at, 0, e.requested_at
    FROM dbo.email_change_requests e
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.email_otps o
        WHERE o.purpose = N'EMAIL_CHANGE' AND o.user_id = e.user_id AND o.is_used = 0
    );

    DROP TABLE dbo.email_change_requests;
END;

/* Existing registration OTPs were stored in plaintext; invalidate them instead of migrating secrets insecurely. */
DELETE FROM dbo.email_otps WHERE purpose = N'REGISTRATION' AND otp_hash IS NULL;
IF COL_LENGTH('dbo.email_otps', 'otp_code') IS NOT NULL
    ALTER TABLE dbo.email_otps DROP COLUMN otp_code;
ALTER TABLE dbo.email_otps ALTER COLUMN otp_hash NVARCHAR(100) NOT NULL;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_email_otps_users')
    ALTER TABLE dbo.email_otps ADD CONSTRAINT FK_email_otps_users
        FOREIGN KEY (user_id) REFERENCES dbo.users(user_id) ON DELETE CASCADE;
ALTER TABLE dbo.email_otps WITH CHECK ADD CONSTRAINT CK_email_otps_payload CHECK (
    (purpose = N'REGISTRATION' AND user_id IS NULL)
    OR (purpose = N'EMAIL_CHANGE' AND user_id IS NOT NULL)
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_email_otps_active_change_email')
    CREATE UNIQUE INDEX UX_email_otps_active_change_email ON dbo.email_otps(email)
        WHERE purpose = N'EMAIL_CHANGE' AND is_used = 0;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_email_otps_active_change_user')
    CREATE UNIQUE INDEX UX_email_otps_active_change_user ON dbo.email_otps(user_id)
        WHERE purpose = N'EMAIL_CHANGE' AND is_used = 0;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_email_otps_reg_active')
    CREATE INDEX IX_email_otps_reg_active ON dbo.email_otps(email, expires_at)
        WHERE purpose = N'REGISTRATION' AND is_used = 0;

COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
