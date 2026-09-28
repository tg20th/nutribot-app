-- Migration: Add category_id to contents table
-- Required for NB-23 feature (video with categories)
-- Date: 2026-09-27
USE [NutriBotV2]
GO

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'contents' AND COLUMN_NAME = 'category_id')
BEGIN
    ALTER TABLE contents ADD category_id INT NULL;
    PRINT 'Added category_id column to contents table';
END
ELSE
BEGIN
    PRINT 'category_id column already exists in contents table';
END
GO

-- Add foreign key constraint if not exists
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'contents' AND COLUMN_NAME = 'category_id')
AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_contents_categories')
BEGIN
    ALTER TABLE contents ADD CONSTRAINT FK_contents_categories FOREIGN KEY (category_id) REFERENCES categories(category_id);
    PRINT 'Added FK_contents_categories constraint';
END
GO

-- Add index if not exists
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'contents' AND COLUMN_NAME = 'category_id')
AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_contents_category_id')
BEGIN
    CREATE INDEX IX_contents_category_id ON contents(category_id);
    PRINT 'Added IX_contents_category_id index';
END
GO
