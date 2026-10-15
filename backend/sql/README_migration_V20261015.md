# Hướng dẫn chạy migration `V20261015__add_ai_processing_status.sql`

## Vấn đề

Status `ai_processing` được thêm vào `AuthorContentService` cho flow bất đồng bộ AI moderation, nhưng DB constraint `CK_contents_status` không cho phép giá trị này → UPDATE fail với lỗi:

> The UPDATE statement conflicted with the CHECK constraint "CK_contents_status"

## Cách chạy migration

### Cách 1: SSMS / Azure Data Studio

1. Mở SSMS hoặc Azure Data Studio
2. Kết nối tới server `localhost` (hoặc server dev của bạn) với user `sa`
3. Chọn database `NutriBotV2`
4. Mở file `sql/V20261015__add_ai_processing_status.sql`
5. Bấm **Execute** (F5)
6. Kết quả mong đợi: `Migration V20261015__add_ai_processing_status: OK`

### Cách 2: sqlcmd

```cmd
sqlcmd -S localhost -U sa -P <password> -d NutriBotV2 -i sql\V20261015__add_ai_processing_status.sql
```

### Cách 3: Chạy inline

```sql
USE NutriBotV2;
GO
ALTER TABLE dbo.contents DROP CONSTRAINT CK_contents_status;
GO
ALTER TABLE dbo.contents
ADD CONSTRAINT CK_contents_status
CHECK (status IN (N'draft', N'ai_processing', N'under_review', N'published', N'flagged', N'rejected', N'archived'));
GO
```

## Verify migration thành công

```sql
SELECT
    cc.name AS constraint_name,
    cc.definition
FROM sys.check_constraints cc
WHERE cc.parent_object_id = OBJECT_ID('dbo.contents')
  AND cc.name = 'CK_contents_status';
```

Kết quả phải có `'ai_processing'` trong danh sách.

## Rollback (nếu cần)

```sql
USE NutriBotV2;
GO
ALTER TABLE dbo.contents DROP CONSTRAINT CK_contents_status;
GO
ALTER TABLE dbo.contents
ADD CONSTRAINT CK_contents_status
CHECK (status IN (N'draft', N'under_review', N'published', N'flagged', N'rejected', N'archived'));
GO
```

## Lưu ý

- **Không cần restart BE** sau khi chạy migration — Hibernate không cache CHECK constraints.
- Sau khi migration xong, test lại flow submit blog: bấm "Post" → status chuyển sang `ai_processing` (không còn lỗi CHECK constraint) → listener chạy bất đồng bộ → cập nhật status cuối.
- File schema master `sql/NutriBotV2_Database.sql` đã được cập nhật để đồng bộ (tái tạo DB từ đầu sẽ bao gồm constraint mới).
