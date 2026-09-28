/*
 * NB-08: users is the canonical owner of avatar_url and bio.
 * Run once against an existing database before deploying the updated entities.
 * Existing users values win when both copies are populated; legacy profile
 * values are copied only where the canonical users value is currently NULL.
 */
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF COL_LENGTH('dbo.user_profiles', 'avatar_url') IS NOT NULL
BEGIN
    EXEC sys.sp_executesql N'
        UPDATE u
        SET avatar_url = COALESCE(u.avatar_url, p.avatar_url)
        FROM dbo.users AS u
        INNER JOIN dbo.user_profiles AS p ON p.user_id = u.user_id
        WHERE u.avatar_url IS NULL AND p.avatar_url IS NOT NULL;';

    ALTER TABLE dbo.user_profiles DROP COLUMN avatar_url;
END;

IF COL_LENGTH('dbo.user_profiles', 'bio') IS NOT NULL
BEGIN
    EXEC sys.sp_executesql N'
        UPDATE u
        SET bio = COALESCE(u.bio, p.bio)
        FROM dbo.users AS u
        INNER JOIN dbo.user_profiles AS p ON p.user_id = u.user_id
        WHERE u.bio IS NULL AND p.bio IS NOT NULL;';

    ALTER TABLE dbo.user_profiles DROP COLUMN bio;
END;

COMMIT TRANSACTION;
