-- =============================================================
-- Migration: Add auth_provider and has_password to users
-- NutriBot - SWP391
-- =============================================================

USE NutriBotV2;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'auth_provider')
BEGIN
    ALTER TABLE users ADD auth_provider NVARCHAR(20) NOT NULL CONSTRAINT DF_users_auth_provider DEFAULT 'LOCAL';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('users') AND name = 'has_password')
BEGIN
    ALTER TABLE users ADD has_password BIT NOT NULL CONSTRAINT DF_users_has_password DEFAULT 1;
END
GO

-- Cập nhật tài khoản Google OAuth hiện có (nếu có)
UPDATE users 
SET auth_provider = 'GOOGLE', has_password = 0 
WHERE email IN ('ngonhattruong555@gmail.com', 'ngonhattruong666@gmail.com');
GO
