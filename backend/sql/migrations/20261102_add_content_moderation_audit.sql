/*
 * Non-destructive SQL Server migration for Admin content moderation reasons
 * and append-only moderation history. Do not run the consolidated initializer
 * against an existing database.
 */

IF COL_LENGTH(N'dbo.content_moderations', N'decision_reason') IS NULL
BEGIN
    ALTER TABLE dbo.content_moderations
        ADD decision_reason NVARCHAR(1000) NULL;
END;
GO

IF OBJECT_ID(N'dbo.content_moderation_audit', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.content_moderation_audit (
        audit_id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        content_id INT NOT NULL,
        content_type NVARCHAR(10) NOT NULL,
        content_title NVARCHAR(255) NOT NULL,
        author_id INT NULL,
        author_username NVARCHAR(50) NULL,
        previous_status NVARCHAR(20) NOT NULL,
        new_status NVARCHAR(20) NOT NULL,
        action NVARCHAR(10) NOT NULL,
        admin_id INT NOT NULL,
        admin_username NVARCHAR(50) NOT NULL,
        admin_reason NVARCHAR(MAX) NULL,
        decided_at DATETIME2(3) NOT NULL
            CONSTRAINT DF_content_moderation_audit_decided_at DEFAULT SYSUTCDATETIME(),
        ai_flagged BIT NULL,
        ai_reason NVARCHAR(MAX) NULL,
        ai_confidence DECIMAL(5,4) NULL,
        content_body_snapshot NVARCHAR(MAX) NULL,
        thumbnail_url_snapshot NVARCHAR(500) NULL,
        media_url_snapshot NVARCHAR(500) NULL,
        CONSTRAINT CK_content_moderation_audit_action
            CHECK (action IN (N'APPROVE', N'REJECT')),
        CONSTRAINT CK_content_moderation_audit_confidence
            CHECK (ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 1))
    );
END;
GO

IF OBJECT_ID(N'dbo.content_moderation_audit', N'U') IS NOT NULL
    AND NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.content_moderation_audit')
          AND name = N'IX_content_moderation_audit_decided_at'
    )
BEGIN
    CREATE INDEX IX_content_moderation_audit_decided_at
        ON dbo.content_moderation_audit(decided_at DESC, audit_id DESC);
END;
GO

IF OBJECT_ID(N'dbo.content_moderation_audit', N'U') IS NOT NULL
    AND NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.content_moderation_audit')
          AND name = N'IX_content_moderation_audit_content'
    )
BEGIN
    CREATE INDEX IX_content_moderation_audit_content
        ON dbo.content_moderation_audit(content_id, decided_at ASC, audit_id ASC);
END;
GO
