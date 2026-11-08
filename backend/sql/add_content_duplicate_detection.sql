-- ============================================================================
-- Migration: Bổ sung các cột phục vụ phát hiện trùng lặp nội dung (NB-97)
-- ============================================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'dbo.contents') AND name = N'content_hash'
)
BEGIN
    ALTER TABLE dbo.contents
    ADD content_hash VARCHAR(64) NULL;
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'dbo.contents') AND name = N'moderation_flag'
)
BEGIN
    ALTER TABLE dbo.contents
    ADD moderation_flag NVARCHAR(50) NULL;
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'dbo.contents') AND name = N'similarity_score'
)
BEGIN
    ALTER TABLE dbo.contents
    ADD similarity_score DECIMAL(5,2) NULL;
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'dbo.contents') AND name = N'matched_content_id'
)
BEGIN
    ALTER TABLE dbo.contents
    ADD matched_content_id INT NULL;
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys 
    WHERE name = N'FK_contents_matched_content'
)
BEGIN
    ALTER TABLE dbo.contents
    ADD CONSTRAINT FK_contents_matched_content 
    FOREIGN KEY (matched_content_id) REFERENCES dbo.contents(content_id) ON DELETE NO ACTION;
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = N'IX_contents_content_hash' AND object_id = OBJECT_ID(N'dbo.contents')
)
BEGIN
    CREATE INDEX IX_contents_content_hash ON dbo.contents(content_hash);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = N'IX_contents_type_title' AND object_id = OBJECT_ID(N'dbo.contents')
)
BEGIN
    CREATE INDEX IX_contents_type_title ON dbo.contents(content_type, title);
END;
GO
