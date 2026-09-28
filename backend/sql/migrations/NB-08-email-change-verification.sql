/* NB-08: persist email changes as pending until their owner verifies them. */
IF OBJECT_ID('dbo.email_change_requests', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.email_change_requests (
        user_id         INT NOT NULL PRIMARY KEY,
        pending_email   NVARCHAR(255) NOT NULL,
        otp_hash        NVARCHAR(100) NOT NULL,
        failed_attempts TINYINT NOT NULL CONSTRAINT DF_email_change_requests_failed_attempts DEFAULT (0),
        expires_at      DATETIME2(3) NOT NULL,
        requested_at    DATETIME2(3) NOT NULL CONSTRAINT DF_email_change_requests_requested_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT UQ_email_change_requests_pending_email UNIQUE (pending_email),
        CONSTRAINT FK_email_change_requests_users FOREIGN KEY (user_id) REFERENCES dbo.users(user_id) ON DELETE CASCADE
    );
END;

IF COL_LENGTH('dbo.email_change_requests', 'otp_hash') IS NULL
BEGIN
    -- Invalidate old link-token requests and migrate the table for OTP codes.
    DELETE FROM dbo.email_change_requests;
    IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_email_change_requests_token_hash')
        ALTER TABLE dbo.email_change_requests DROP CONSTRAINT UQ_email_change_requests_token_hash;
    ALTER TABLE dbo.email_change_requests DROP COLUMN token_hash;
    ALTER TABLE dbo.email_change_requests ADD otp_hash NVARCHAR(100) NULL;
    ALTER TABLE dbo.email_change_requests ADD failed_attempts TINYINT NOT NULL
        CONSTRAINT DF_email_change_requests_failed_attempts DEFAULT (0);
    ALTER TABLE dbo.email_change_requests ALTER COLUMN otp_hash NVARCHAR(100) NOT NULL;
END;
