-- ============================================================
-- Migration: Add 'ai_processing' to CK_contents_status
-- ============================================================
-- Author : NB: post async (post-async-ai-moderation)
-- Date   : 2026-10-15
-- Issue  : Status 'ai_processing' was added to AuthorContentService
--          for async AI moderation flow, but DB CHECK constraint
--          CK_contents_status does not include it -> UPDATE fails
--          with DataIntegrityViolationException ("Thao tác bị trùng
--          lặp hoặc xung đột dữ liệu").
--
-- Effect : Allow 'ai_processing' as a valid status value for
--          contents.status. Other constraints unchanged.
-- ============================================================

USE NutriBotV2;
GO

-- Drop and re-add CHECK constraint with 'ai_processing'
ALTER TABLE dbo.contents DROP CONSTRAINT CK_contents_status;
GO

ALTER TABLE dbo.contents
ADD CONSTRAINT CK_contents_status
CHECK (status IN (N'draft', N'ai_processing', N'under_review', N'published', N'flagged', N'rejected', N'archived'));
GO

PRINT 'Migration V20261015__add_ai_processing_status: OK';
GO
