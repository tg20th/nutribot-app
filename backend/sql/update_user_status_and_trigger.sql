-- =============================================
-- Migration Script: Cập nhật Trạng thái Mặc định PENDING_VERIFY và Sửa Trigger Users
-- Mục đích: Đảm bảo tài khoản mới tạo luôn ở trạng thái PENDING_VERIFY,
--          không bị Trigger tự động chuyển sang ACTIVE trước khi xác thực OTP.
-- An toàn: Chạy được trực tiếp trên CSDL NutriBotV2 hiện tại mà không mất dữ liệu.
-- =============================================

USE NutriBotV2;
GO

SET NOCOUNT ON;
PRINT N'Bắt đầu cập nhật schema cho bảng users và trigger...';
GO

-- 1. Kiểm tra và cập nhật Check Constraint CK_users_status để hỗ trợ PENDING_VERIFY
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_users_status')
BEGIN
    ALTER TABLE users DROP CONSTRAINT CK_users_status;
    PRINT N'Đã xóa ràng buộc CK_users_status cũ.';
END
GO

ALTER TABLE users ADD CONSTRAINT CK_users_status 
    CHECK (status IN (N'ACTIVE', N'WARN', N'SUSPENDED', N'BANNED', N'PENDING_VERIFY'));
PRINT N'Đã tạo lại ràng buộc CK_users_status với đầy đủ 5 trạng thái.';
GO

-- 2. Cập nhật Default Constraint DF_users_status sang N'PENDING_VERIFY'
DECLARE @DefaultConstraintName NVARCHAR(128);
SELECT @DefaultConstraintName = dc.name
FROM sys.default_constraints dc
INNER JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
WHERE dc.parent_object_id = OBJECT_ID('users') AND c.name = 'status';

IF @DefaultConstraintName IS NOT NULL
BEGIN
    DECLARE @DropSql NVARCHAR(MAX) = N'ALTER TABLE users DROP CONSTRAINT ' + QUOTENAME(@DefaultConstraintName) + N';';
    EXEC sp_executesql @DropSql;
    PRINT N'Đã xóa Default Constraint cũ: ' + @DefaultConstraintName;
END
GO

ALTER TABLE users ADD CONSTRAINT DF_users_status DEFAULT (N'PENDING_VERIFY') FOR status;
PRINT N'Đã tạo mới Default Constraint DF_users_status với giá trị mặc định N''PENDING_VERIFY''.';
GO

-- 3. Tạo lại / Cập nhật Trigger TR_users_auto_update_status_by_strike
-- Đảm bảo giữ nguyên PENDING_VERIFY khi thêm mới hoặc sửa
CREATE OR ALTER TRIGGER TR_users_auto_update_status_by_strike
ON users
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;

    UPDATE u
    SET status = CASE
                    WHEN i.status IN (N'BANNED', N'PENDING_VERIFY') THEN i.status
                    WHEN i.strike_count >= 3 THEN N'SUSPENDED'
                    WHEN i.strike_count BETWEEN 1 AND 2 THEN N'WARN'
                    ELSE N'ACTIVE'
                 END,
        updated_at = SYSUTCDATETIME()
    FROM users u
    INNER JOIN inserted i ON u.user_id = i.user_id;
END;
GO
PRINT N'Đã cập nhật Trigger TR_users_auto_update_status_by_strike thành công.';
GO

-- 4. Bảng email_otps nếu chưa có thì tạo mới
IF OBJECT_ID(N'email_otps', N'U') IS NULL
BEGIN
    CREATE TABLE email_otps (
        otp_id         INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        email          NVARCHAR(255) NOT NULL,
        otp_hash       NVARCHAR(100) NOT NULL,
        purpose        NVARCHAR(30) NOT NULL CONSTRAINT DF_email_otps_purpose DEFAULT (N'REGISTRATION'),
        user_id        INT NULL,
        failed_attempts TINYINT NOT NULL CONSTRAINT DF_email_otps_failed_attempts DEFAULT (0),
        expires_at     DATETIME2(3) NOT NULL,
        is_used        BIT NOT NULL CONSTRAINT DF_email_otps_is_used DEFAULT (0),
        created_at     DATETIME2(3) NOT NULL CONSTRAINT DF_email_otps_created_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT CK_email_otps_payload CHECK (
            (purpose = N'REGISTRATION' AND user_id IS NULL)
            OR (purpose = N'EMAIL_CHANGE' AND user_id IS NOT NULL)
        ),
        CONSTRAINT FK_email_otps_users FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );
    CREATE NONCLUSTERED INDEX IX_email_otps_email ON email_otps(email, expires_at, is_used) WHERE is_used = 0;
    CREATE UNIQUE NONCLUSTERED INDEX UX_email_otps_active_change_email ON email_otps(email)
        WHERE purpose = N'EMAIL_CHANGE' AND is_used = 0;
    CREATE UNIQUE NONCLUSTERED INDEX UX_email_otps_active_change_user ON email_otps(user_id)
        WHERE purpose = N'EMAIL_CHANGE' AND is_used = 0;
    PRINT N'Đã tạo mới bảng email_otps và index IX_email_otps_email.';
END
ELSE
BEGIN
    PRINT N'Bảng email_otps đã tồn tại, bỏ qua tạo mới.';
END
GO

PRINT N'Hoàn tất cập nhật CSDL NutriBotV2 thành công!';
GO
