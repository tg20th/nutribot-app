/*
   NB-98: Convert legacy contents.body HTML to readable plain text.
   SQL Server script; intentionally updates only dbo.contents.body.
   Safe to rerun: already-converted rows no longer match the WHERE clause.
   Review the affected-row count before COMMIT. This script is not executed by the application.
*/
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @UpdatedRows TABLE (content_id INT PRIMARY KEY);
DECLARE @ContentId INT;
DECLARE @Body NVARCHAR(MAX);
DECLARE @TagStart INT;
DECLARE @TagEnd INT;
DECLARE @Tag NVARCHAR(4000);

DECLARE content_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT content_id, body
    FROM dbo.contents
    WHERE body LIKE N'%<%' OR body LIKE N'%&amp;%' OR body LIKE N'%&nbsp;%' OR body LIKE N'%&#%;';

OPEN content_cursor;
FETCH NEXT FROM content_cursor INTO @ContentId, @Body;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @Body = REPLACE(REPLACE(@Body, N'<!-- StartFragment -->', N''), N'<!-- EndFragment -->', N'');
    SET @Body = REPLACE(@Body, N'<!--STARTFRAGMENT-->', N'');
    SET @Body = REPLACE(@Body, N'<!--ENDFRAGMENT-->', N'');

    SET @Body = REPLACE(@Body, N'<br>', NCHAR(10));
    SET @Body = REPLACE(@Body, N'<br/>', NCHAR(10));
    SET @Body = REPLACE(@Body, N'<br />', NCHAR(10));
    SET @Body = REPLACE(@Body, N'</p>', NCHAR(10));
    SET @Body = REPLACE(@Body, N'</div>', NCHAR(10));
    SET @Body = REPLACE(@Body, N'</li>', NCHAR(10));
    SET @Body = REPLACE(@Body, N'</blockquote>', NCHAR(10));

    SET @TagStart = CHARINDEX(N'<', @Body);
    WHILE @TagStart > 0
    BEGIN
        SET @TagEnd = CHARINDEX(N'>', @Body, @TagStart + 1);
        IF @TagEnd = 0 BREAK;
        SET @Tag = LOWER(SUBSTRING(@Body, @TagStart, @TagEnd - @TagStart + 1));
        SET @Body = STUFF(@Body, @TagStart, @TagEnd - @TagStart + 1, N'');
        SET @TagStart = CHARINDEX(N'<', @Body);
    END;

    SET @Body = REPLACE(@Body, N'&nbsp;', N' ');
    SET @Body = REPLACE(@Body, N'&amp;', N'&');
    SET @Body = REPLACE(@Body, N'&lt;', N'<');
    SET @Body = REPLACE(@Body, N'&gt;', N'>');
    SET @Body = REPLACE(@Body, N'&quot;', N'"');
    SET @Body = REPLACE(@Body, N'&#39;', N'''');
    SET @Body = REPLACE(@Body, N'&apos;', N'''');
    SET @Body = REPLACE(@Body, NCHAR(13) + NCHAR(10), NCHAR(10));
    SET @Body = REPLACE(@Body, NCHAR(13), NCHAR(10));
    WHILE CHARINDEX(NCHAR(10) + NCHAR(10) + NCHAR(10), @Body) > 0
        SET @Body = REPLACE(@Body, NCHAR(10) + NCHAR(10) + NCHAR(10), NCHAR(10) + NCHAR(10));
    SET @Body = LTRIM(RTRIM(@Body));

    UPDATE dbo.contents SET body = @Body OUTPUT inserted.content_id INTO @UpdatedRows WHERE content_id = @ContentId;
    FETCH NEXT FROM content_cursor INTO @ContentId, @Body;
END;
CLOSE content_cursor;
DEALLOCATE content_cursor;

SELECT COUNT(*) AS updated_rows FROM @UpdatedRows;
SELECT c.content_id, c.content_type, c.title, c.body
FROM dbo.contents c JOIN @UpdatedRows u ON u.content_id = c.content_id
ORDER BY c.content_id;

/* Replace ROLLBACK with COMMIT only after reviewing the preview above. */
ROLLBACK TRANSACTION;
