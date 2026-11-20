/*
 * Import content metadata from the Google Sheet:
 * NutriBotV2 - Bảng Mapping Hình ảnh & Video (06/11 - 21/11/2026)
 * https://docs.google.com/spreadsheets/d/14NJPth7GAVeKxW3eOrwbKr4J5J5xIcmfIQ0XYeaq4wA/edit
 *
 * Run after NutriBotV2_FULL_RELATIONAL_MODERATION_AUDIT.sql and
 * NutriBotV2_SampleData_ENGLISH_PLANT_BASED.sql.
 * Idempotent by slug; timestamps retain the sheet's planned date and use
 * intentionally varied times-of-day. All datetime values are local Saigon
 * wall-clock values, consistent with the spreadsheet timezone.
 *
 * The sheet has no video_url for rows 7 and 11, so those video records remain
 * drafts until a playable URL is supplied. Row 16 has a TikTok URL.
 * Includes structured recipe details, ingredients and steps for the 15 blog entries.
 */
SET XACT_ABORT ON;
BEGIN TRANSACTION;

MERGE dbo.contents AS target
USING (VALUES
    (N'mapping-2026-001-banh-xeo-chay-nam-moi', 4, N'BLOG', 43, N'Bánh xèo chay nấm mối giòn rụm', N'Bánh xèo chay với nấm mối, vỏ bánh vàng giòn và phần nhân đậm vị. Bài viết giới thiệu món Việt thuần chay phù hợp cho bữa ăn quây quần.', N'https://storage.googleapis.com/onelife-public/banh_xeo_chay_thumbnail_641f3a28cf/banh_xeo_chay_thumbnail_641f3a28cf.jpg', NULL, NULL, N'published', 284, '2026-11-06T09:42:00', '2026-11-06T09:42:00'),
    (N'mapping-2026-002-bun-mam-chay-mien-tay', 5, N'BLOG', 43, N'Bún mắm chay miền Tây đậm đà', N'Gợi ý một phiên bản bún mắm chay lấy cảm hứng từ ẩm thực miền Tây, kết hợp rau ăn kèm và hương vị đặc trưng.', N'https://cdn11.dienmaycholon.vn/filewebdmclnew/public/userupload/files/kien-thuc/cach-lam-bun-mam-chay/cach-lam-bun-mam-chay-1.jpg', NULL, NULL, N'published', 731, '2026-11-10T16:13:00', '2026-11-10T16:13:00'),
    (N'mapping-2026-003-banh-uot-cha-lua-chay', 6, N'BLOG', 43, N'Bánh ướt chả lụa chay & nước mắm chua ngọt', N'Bánh ướt mềm dùng cùng chả lụa chay và nước mắm chua ngọt, một gợi ý món Việt thanh nhẹ cho bữa sáng hoặc bữa phụ.', N'https://giavichinsu.com/wp-content/uploads/2025/07/cach-lam-nuoc-mam-an-banh-uot-ngon-dam-vi-tai-nha-4.png', NULL, NULL, N'published', 163, '2026-11-11T08:27:00', '2026-11-11T08:27:00'),
    (N'mapping-2026-004-sua-hat-dieu-cacao', 7, N'BLOG', 40, N'Sữa hạt điều cacao nguyên chất ít đường', N'Giới thiệu thức uống từ hạt điều và cacao nguyên chất với vị ngọt vừa phải, phù hợp khi muốn đổi vị bằng một món uống thực vật.', N'https://afamilycdn.com/150157425591193600/2023/8/17/sua-hat-dieu-cacao-thumbnail-16922648524292005945552.jpg', NULL, NULL, N'published', 508, '2026-11-13T13:54:00', '2026-11-13T13:54:00'),
    (N'mapping-2026-005-kimbap-gao-lut-bo-sap', 8, N'BLOG', 44, N'Cơm cuộn kimbap gạo lứt bơ sáp', N'Kimbap gạo lứt kết hợp bơ sáp và rau củ, tạo thành lựa chọn tiện mang theo cho bữa ăn kiểu Hàn.', N'https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/kimbap_gao_lut_2_4ed81ea094.jpg', NULL, NULL, N'published', 946, '2026-11-14T07:35:00', '2026-11-14T07:35:00'),
    (N'mapping-2026-006-dau-hu-tu-xuyen-chay', 9, N'BLOG', 44, N'Đậu hũ non sốt Tứ Xuyên chay cay nhẹ', N'Đậu hũ non mềm dùng cùng sốt Tứ Xuyên phiên bản chay có vị cay nhẹ, lấy cảm hứng từ món ăn quen thuộc của ẩm thực Trung Hoa.', N'https://cdn.tgdd.vn/Files/2020/08/21/1282139/cach-lam-dau-hu-tu-xuyen-202008211354567297.jpg', NULL, NULL, N'published', 372, '2026-11-14T18:22:00', '2026-11-14T18:22:00'),
    (N'mapping-2026-007-meal-prep-hop-com-thuan-chay', 4, N'VIDEO', 49, N'Chuẩn bị 3 hộp cơm trưa thuần chay cho cả tuần', NULL, NULL, N'https://www.lemon8-app.com/seo/image?item_id=7272184668387230210&index=1&sign=1112dacbc337de3bca334ff04f61750c', NULL, N'draft', 0, '2026-11-14T11:06:00', '2026-11-14T11:06:00'),
    (N'mapping-2026-008-canh-chua-nam-bong-dien-dien', 5, N'BLOG', 43, N'Canh chua nấm bông điên điển thanh mát', N'Canh chua nấu cùng nấm và bông điên điển, gợi ý món Việt có vị thanh mát cho bữa cơm gia đình.', N'https://cdn.tgdd.vn/2021/02/CookProductThumb/Untitled-2-620x620-7.jpg', NULL, NULL, N'published', 618, '2026-11-15T20:11:00', '2026-11-15T20:11:00'),
    (N'mapping-2026-009-mi-udon-xao-nam-dong-co', 6, N'BLOG', 44, N'Mì Udon xào nấm đông cô sốt Teriyaki', N'Mì Udon dai mềm xào cùng nấm đông cô và sốt Teriyaki, một gợi ý món Á cho bữa ăn đủ vị.', N'https://tteokbokki.vn/cdn/shop/products/Udon-Noodle-Stir-Fry-square.jpg?v=1658467965', NULL, NULL, N'published', 92, '2026-11-15T09:18:00', '2026-11-15T09:18:00'),
    (N'mapping-2026-010-mi-y-pesto-hung-que-hat-thong', 7, N'BLOG', 45, N'Mì Ý sốt Pesto húng quế hạt thông', N'Mì Ý kết hợp sốt Pesto húng quế và hạt thông, giới thiệu hương vị Địa Trung Hải trong phiên bản món ăn thực vật.', N'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTCTUHthDJ8Unf3i-lRTEwtHH-IpnHkFaX6rGxXEmqBzfOlTyQxiRM-TLk&s=10', NULL, NULL, N'published', 807, '2026-11-15T15:46:00', '2026-11-15T15:46:00'),
    (N'mapping-2026-011-sua-hat-khong-tach-nuoc-video', 8, N'VIDEO', 40, N'Cách nấu sữa hạt không bị tách nước tại nhà', NULL, NULL, N'https://thuanchay.vn/wp-content/uploads/2024/03/26-Cach-Lam-Sua-Hat-Dinh-Duong-Khong-Bi-Tach-Nuoc-6.webp', NULL, N'draft', 0, '2026-11-15T06:54:00', '2026-11-15T06:54:00'),
    (N'mapping-2026-012-goi-ngo-sen-dau-hu-chien', 9, N'BLOG', 43, N'Gỏi ngó sen đậu hũ chiên giòn trộn chua ngọt', N'Gỏi ngó sen giòn trộn cùng đậu hũ chiên và nước trộn chua ngọt, một gợi ý món khai vị mang hương vị Việt.', N'https://www.huongnghiepaau.com/wp-content/uploads/2017/03/so-che-nguyen-lieu-theo-huong-dan.jpg', NULL, NULL, N'published', 451, '2026-11-16T12:31:00', '2026-11-16T12:31:00'),
    (N'mapping-2026-013-pad-thai-dau-hu-sot-me', 4, N'BLOG', 44, N'Pad Thai đậu hũ sốt me chuẩn vị Thái', N'Pad Thai phiên bản chay với đậu hũ và sốt me, lấy cảm hứng từ món mì xào nổi tiếng của Thái Lan.', N'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRWKHlM3HtF8Xd5pJO0nYMnadRkKBDvnJ6dlOx5fuCgor3hkjoOhOoA4D0&s=10', NULL, NULL, N'published', 990, '2026-11-17T19:05:00', '2026-11-17T19:05:00'),
    (N'mapping-2026-014-sinh-to-cai-bo-xoi-dua-hat-lanh', 5, N'BLOG', 39, N'Sinh tố cải bó xôi dứa hạt lanh detox', N'Sinh tố kết hợp cải bó xôi, dứa và hạt lanh, gợi ý thức uống trái cây rau xanh cho thực đơn hằng ngày.', N'https://www.huongnghiepaau.com/wp-content/uploads/2021/12/nuoc-ep-cai-bo-xoi-co-loi-cho-suc-khoe.jpg', NULL, NULL, N'published', 239, '2026-11-17T08:12:00', '2026-11-17T08:12:00'),
    (N'mapping-2026-015-burger-dau-den-yen-mach', 6, N'BLOG', 45, N'Burger đậu đen yến mạch nướng giàu đạm', N'Burger thực vật làm từ đậu đen và yến mạch, một gợi ý món ăn giàu đạm thực vật cho bữa chính.', N'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR3toLBVxI5V3lscIBGOI-Jc95eLb-ljT8InsZC6qSrAQ-_igHQayUWzCg&s=10', NULL, NULL, N'published', 684, '2026-11-18T14:27:00', '2026-11-18T14:27:00'),
    (N'mapping-2026-016-sot-tron-salad-thuan-chay-video', 7, N'VIDEO', 49, N'3 công thức nước sốt trộn salad thuần chay béo ngậy', NULL, N'https://www.tiktok.com/@anchaycungnhi/video/7528383938415693063', N'https://cdn.tgdd.vn/2024/11/CookRecipe/CookTipsNote/tong-hop-15-cong-thuc-cac-loai-sot-tron-salad-giam-can-lam-tipsnote-800x533-9.jpg', NULL, N'published', 127, '2026-11-18T10:02:00', '2026-11-18T10:02:00'),
    (N'mapping-2026-017-sup-rong-bien-dau-phu-non', 8, N'BLOG', 44, N'Súp rong biển đậu phụ non Hàn Quốc', N'Súp rong biển nấu cùng đậu phụ non theo cảm hứng ẩm thực Hàn Quốc, phù hợp cho bữa ăn nhẹ nhàng.', N'https://ttol.vietnamnetjsc.vn/images/2022/07/05/06/57/a.jpg?width=0&s=1pEvftP6kVA0npUeVk4_Pg', NULL, NULL, N'published', 571, '2026-11-19T21:38:00', '2026-11-19T21:38:00'),
    (N'mapping-2026-018-com-cari-xanh-thai-rau-cu', 9, N'BLOG', 44, N'Cơm cà ri xanh Thái rau củ cốt dừa', N'Cơm ăn cùng cà ri xanh Thái nấu rau củ và nước cốt dừa, gợi ý món chính đậm hương vị Đông Nam Á.', N'https://file.hstatic.net/200000561069/file/dscf5337_05039b9cb8c84d978db1aba820555963.jpg', NULL, NULL, N'published', 346, '2026-11-20T07:44:00', '2026-11-20T07:44:00')
) AS source(slug, user_id, content_type, category_id, title, body, media_url, thumbnail_url, duration_sec, status, view_count, created_at, updated_at)
ON target.slug = source.slug
WHEN MATCHED THEN UPDATE SET
    user_id = source.user_id,
    content_type = source.content_type,
    category_id = source.category_id,
    title = source.title,
    body = source.body,
    media_url = CASE WHEN source.content_type = N'VIDEO' THEN source.media_url ELSE NULL END,
    thumbnail_url = CASE WHEN source.content_type = N'VIDEO' THEN source.thumbnail_url ELSE source.media_url END,
    duration_sec = source.duration_sec,
    status = source.status,
    view_count = source.view_count,
    created_at = source.created_at,
    updated_at = source.updated_at
WHEN NOT MATCHED THEN INSERT
    (user_id, content_type, category_id, title, slug, body, media_url, thumbnail_url, duration_sec, status, view_count, created_at, updated_at)
    VALUES
    (source.user_id, source.content_type, source.category_id, source.title, source.slug, source.body,
     CASE WHEN source.content_type = N'VIDEO' THEN source.media_url ELSE NULL END,
     CASE WHEN source.content_type = N'VIDEO' THEN source.thumbnail_url ELSE source.media_url END,
     source.duration_sec, source.status, source.view_count, source.created_at, source.updated_at);



-- Structured recipe details, ingredients and steps (15 blog posts).
-- Ingredient quantities and instructions are composed from titles in the sheet.
-- Nutrition numbers are estimates, not verified label or laboratory values.
DECLARE @Recipes TABLE (
    slug NVARCHAR(280) NOT NULL PRIMARY KEY,
    prep_minutes INT NOT NULL,
    cook_minutes INT NOT NULL,
    servings INT NOT NULL,
    calories DECIMAL(12,2) NOT NULL,
    protein_g DECIMAL(12,2) NOT NULL,
    carbs_g DECIMAL(12,2) NOT NULL,
    fat_g DECIMAL(12,2) NOT NULL,
    fiber_g DECIMAL(12,2) NOT NULL,
    sodium_mg DECIMAL(12,2) NOT NULL
);

INSERT INTO @Recipes VALUES
(N'mapping-2026-001-banh-xeo-chay-nam-moi', 25, 25, 2, 438, 14, 58, 17, 8, 610),
(N'mapping-2026-002-bun-mam-chay-mien-tay', 25, 35, 2, 486, 21, 67, 14, 9, 920),
(N'mapping-2026-003-banh-uot-cha-lua-chay', 30, 20, 2, 412, 15, 63, 10, 4, 780),
(N'mapping-2026-004-sua-hat-dieu-cacao', 10, 15, 2, 246, 7, 24, 15, 3, 92),
(N'mapping-2026-005-kimbap-gao-lut-bo-sap', 25, 25, 2, 421, 13, 58, 16, 8, 530),
(N'mapping-2026-006-dau-hu-tu-xuyen-chay', 15, 20, 2, 278, 18, 18, 14, 4, 690),
(N'mapping-2026-008-canh-chua-nam-bong-dien-dien', 20, 25, 2, 192, 9, 29, 5, 6, 570),
(N'mapping-2026-009-mi-udon-xao-nam-dong-co', 20, 20, 2, 438, 17, 68, 11, 6, 740),
(N'mapping-2026-010-mi-y-pesto-hung-que-hat-thong', 15, 20, 2, 512, 16, 65, 22, 7, 590),
(N'mapping-2026-012-goi-ngo-sen-dau-hu-chien', 25, 15, 2, 326, 16, 35, 14, 7, 640),
(N'mapping-2026-013-pad-thai-dau-hu-sot-me', 25, 20, 2, 472, 18, 70, 14, 7, 820),
(N'mapping-2026-014-sinh-to-cai-bo-xoi-dua-hat-lanh', 10, 0, 2, 218, 6, 38, 7, 9, 88),
(N'mapping-2026-015-burger-dau-den-yen-mach', 25, 25, 2, 398, 20, 54, 11, 12, 570),
(N'mapping-2026-017-sup-rong-bien-dau-phu-non', 15, 20, 2, 184, 14, 16, 7, 3, 620),
(N'mapping-2026-018-com-cari-xanh-thai-rau-cu', 25, 30, 2, 526, 13, 72, 20, 8, 680);

MERGE dbo.content_recipe_details AS target
USING (
    SELECT c.content_id, r.prep_minutes, r.cook_minutes, r.servings,
           r.calories, r.protein_g, r.carbs_g, r.fat_g, r.fiber_g, r.sodium_mg
    FROM @Recipes r
    JOIN dbo.contents c ON c.slug = r.slug AND c.content_type = N'BLOG'
) AS source
ON target.content_id = source.content_id
WHEN MATCHED THEN UPDATE SET
    prep_minutes = source.prep_minutes, cook_minutes = source.cook_minutes,
    servings = source.servings, calories = source.calories,
    protein_g = source.protein_g, carbs_g = source.carbs_g,
    fat_g = source.fat_g, fiber_g = source.fiber_g, sodium_mg = source.sodium_mg
WHEN NOT MATCHED THEN INSERT
    (content_id, prep_minutes, cook_minutes, servings, calories, protein_g, carbs_g, fat_g, fiber_g, sodium_mg)
    VALUES (source.content_id, source.prep_minutes, source.cook_minutes, source.servings,
            source.calories, source.protein_g, source.carbs_g, source.fat_g, source.fiber_g, source.sodium_mg);

-- Replace rows for these recipes so rerunning the script cannot duplicate ingredients or steps.
DELETE i FROM dbo.content_recipe_ingredients i
JOIN dbo.contents c ON c.content_id = i.content_id
JOIN @Recipes r ON r.slug = c.slug;
DELETE s FROM dbo.content_recipe_steps s
JOIN dbo.contents c ON c.content_id = s.content_id
JOIN @Recipes r ON r.slug = c.slug;

INSERT INTO dbo.content_recipe_ingredients (content_id, sort_order, ingredient_name, quantity, unit, is_custom)
SELECT c.content_id, v.sort_order, v.ingredient_name, v.quantity, v.unit, 1
FROM (VALUES
 (N'mapping-2026-001-banh-xeo-chay-nam-moi',1,N'Bột bánh xèo',N'150',N'g'),
 (N'mapping-2026-001-banh-xeo-chay-nam-moi',2,N'Nước cốt dừa',N'100',N'ml'),
 (N'mapping-2026-001-banh-xeo-chay-nam-moi',3,N'Nấm mối hoặc nấm đùi gà',N'150',N'g'),
 (N'mapping-2026-001-banh-xeo-chay-nam-moi',4,N'Đậu xanh cà vỏ',N'50',N'g'),
 (N'mapping-2026-001-banh-xeo-chay-nam-moi',5,N'Giá đỗ',N'100',N'g'),
 (N'mapping-2026-001-banh-xeo-chay-nam-moi',6,N'Rau sống và dầu ăn',N'1',N'phần'),
 (N'mapping-2026-002-bun-mam-chay-mien-tay',1,N'Bún tươi',N'300',N'g'),
 (N'mapping-2026-002-bun-mam-chay-mien-tay',2,N'Chao hoặc mắm đậu chay',N'40',N'g'),
 (N'mapping-2026-002-bun-mam-chay-mien-tay',3,N'Đậu hũ chiên',N'160',N'g'),
 (N'mapping-2026-002-bun-mam-chay-mien-tay',4,N'Cà tím',N'120',N'g'),
 (N'mapping-2026-002-bun-mam-chay-mien-tay',5,N'Dứa',N'100',N'g'),
 (N'mapping-2026-002-bun-mam-chay-mien-tay',6,N'Sả, rau sống và gia vị',N'1',N'phần'),
 (N'mapping-2026-003-banh-uot-cha-lua-chay',1,N'Bột gạo',N'150',N'g'),
 (N'mapping-2026-003-banh-uot-cha-lua-chay',2,N'Bột năng',N'30',N'g'),
 (N'mapping-2026-003-banh-uot-cha-lua-chay',3,N'Chả lụa chay',N'150',N'g'),
 (N'mapping-2026-003-banh-uot-cha-lua-chay',4,N'Dưa leo',N'100',N'g'),
 (N'mapping-2026-003-banh-uot-cha-lua-chay',5,N'Rau thơm',N'30',N'g'),
 (N'mapping-2026-003-banh-uot-cha-lua-chay',6,N'Nước tương, giấm và đường',N'1',N'phần'),
 (N'mapping-2026-004-sua-hat-dieu-cacao',1,N'Hạt điều sống',N'80',N'g'),
 (N'mapping-2026-004-sua-hat-dieu-cacao',2,N'Nước lọc',N'600',N'ml'),
 (N'mapping-2026-004-sua-hat-dieu-cacao',3,N'Bột cacao nguyên chất',N'10',N'g'),
 (N'mapping-2026-004-sua-hat-dieu-cacao',4,N'Chà là hoặc si-rô',N'15',N'g'),
 (N'mapping-2026-004-sua-hat-dieu-cacao',5,N'Tinh chất vani',N'2',N'ml'),
 (N'mapping-2026-004-sua-hat-dieu-cacao',6,N'Muối',N'1',N'g'),
 (N'mapping-2026-005-kimbap-gao-lut-bo-sap',1,N'Gạo lứt đã nấu chín',N'300',N'g'),
 (N'mapping-2026-005-kimbap-gao-lut-bo-sap',2,N'Bơ sáp',N'100',N'g'),
 (N'mapping-2026-005-kimbap-gao-lut-bo-sap',3,N'Đậu hũ áp chảo',N'120',N'g'),
 (N'mapping-2026-005-kimbap-gao-lut-bo-sap',4,N'Cà rốt',N'60',N'g'),
 (N'mapping-2026-005-kimbap-gao-lut-bo-sap',5,N'Dưa leo',N'60',N'g'),
 (N'mapping-2026-005-kimbap-gao-lut-bo-sap',6,N'Rong biển cuộn cơm',N'2',N'tấm'),
 (N'mapping-2026-006-dau-hu-tu-xuyen-chay',1,N'Đậu hũ non',N'300',N'g'),
 (N'mapping-2026-006-dau-hu-tu-xuyen-chay',2,N'Nấm đông cô',N'80',N'g'),
 (N'mapping-2026-006-dau-hu-tu-xuyen-chay',3,N'Tương đậu cay chay',N'20',N'g'),
 (N'mapping-2026-006-dau-hu-tu-xuyen-chay',4,N'Tỏi và gừng băm',N'15',N'g'),
 (N'mapping-2026-006-dau-hu-tu-xuyen-chay',5,N'Hành lá',N'20',N'g'),
 (N'mapping-2026-006-dau-hu-tu-xuyen-chay',6,N'Bột bắp và dầu mè',N'1',N'phần'),
 (N'mapping-2026-008-canh-chua-nam-bong-dien-dien',1,N'Nấm bào ngư',N'150',N'g'),
 (N'mapping-2026-008-canh-chua-nam-bong-dien-dien',2,N'Bông điên điển',N'100',N'g'),
 (N'mapping-2026-008-canh-chua-nam-bong-dien-dien',3,N'Dứa',N'100',N'g'),
 (N'mapping-2026-008-canh-chua-nam-bong-dien-dien',4,N'Cà chua',N'100',N'g'),
 (N'mapping-2026-008-canh-chua-nam-bong-dien-dien',5,N'Nước me',N'30',N'ml'),
 (N'mapping-2026-008-canh-chua-nam-bong-dien-dien',6,N'Rau om, ngò gai và gia vị',N'1',N'phần'),
 (N'mapping-2026-009-mi-udon-xao-nam-dong-co',1,N'Mì udon',N'300',N'g'),
 (N'mapping-2026-009-mi-udon-xao-nam-dong-co',2,N'Nấm đông cô',N'120',N'g'),
 (N'mapping-2026-009-mi-udon-xao-nam-dong-co',3,N'Đậu hũ',N'120',N'g'),
 (N'mapping-2026-009-mi-udon-xao-nam-dong-co',4,N'Bông cải xanh',N'100',N'g'),
 (N'mapping-2026-009-mi-udon-xao-nam-dong-co',5,N'Nước tương',N'20',N'ml'),
 (N'mapping-2026-009-mi-udon-xao-nam-dong-co',6,N'Sốt teriyaki chay và dầu ăn',N'1',N'phần'),
 (N'mapping-2026-010-mi-y-pesto-hung-que-hat-thong',1,N'Mì Ý khô',N'180',N'g'),
 (N'mapping-2026-010-mi-y-pesto-hung-que-hat-thong',2,N'Lá húng quế',N'30',N'g'),
 (N'mapping-2026-010-mi-y-pesto-hung-que-hat-thong',3,N'Hạt thông',N'20',N'g'),
 (N'mapping-2026-010-mi-y-pesto-hung-que-hat-thong',4,N'Dầu ô liu',N'25',N'ml'),
 (N'mapping-2026-010-mi-y-pesto-hung-que-hat-thong',5,N'Tỏi',N'5',N'g'),
 (N'mapping-2026-010-mi-y-pesto-hung-que-hat-thong',6,N'Men dinh dưỡng và chanh',N'1',N'phần'),
 (N'mapping-2026-012-goi-ngo-sen-dau-hu-chien',1,N'Ngó sen',N'180',N'g'),
 (N'mapping-2026-012-goi-ngo-sen-dau-hu-chien',2,N'Đậu hũ chiên',N'150',N'g'),
 (N'mapping-2026-012-goi-ngo-sen-dau-hu-chien',3,N'Cà rốt',N'50',N'g'),
 (N'mapping-2026-012-goi-ngo-sen-dau-hu-chien',4,N'Rau răm',N'15',N'g'),
 (N'mapping-2026-012-goi-ngo-sen-dau-hu-chien',5,N'Đậu phộng rang',N'20',N'g'),
 (N'mapping-2026-012-goi-ngo-sen-dau-hu-chien',6,N'Giấm, đường và nước tương',N'1',N'phần'),
 (N'mapping-2026-013-pad-thai-dau-hu-sot-me',1,N'Bánh phở khô',N'180',N'g'),
 (N'mapping-2026-013-pad-thai-dau-hu-sot-me',2,N'Đậu hũ',N'160',N'g'),
 (N'mapping-2026-013-pad-thai-dau-hu-sot-me',3,N'Giá đỗ',N'100',N'g'),
 (N'mapping-2026-013-pad-thai-dau-hu-sot-me',4,N'Nước me và nước tương',N'30',N'g'),
 (N'mapping-2026-013-pad-thai-dau-hu-sot-me',5,N'Đậu phộng rang',N'20',N'g'),
 (N'mapping-2026-013-pad-thai-dau-hu-sot-me',6,N'Hẹ, chanh và đường thốt nốt',N'1',N'phần'),
 (N'mapping-2026-014-sinh-to-cai-bo-xoi-dua-hat-lanh',1,N'Cải bó xôi',N'40',N'g'),
 (N'mapping-2026-014-sinh-to-cai-bo-xoi-dua-hat-lanh',2,N'Dứa',N'180',N'g'),
 (N'mapping-2026-014-sinh-to-cai-bo-xoi-dua-hat-lanh',3,N'Chuối',N'80',N'g'),
 (N'mapping-2026-014-sinh-to-cai-bo-xoi-dua-hat-lanh',4,N'Hạt lanh xay',N'10',N'g'),
 (N'mapping-2026-014-sinh-to-cai-bo-xoi-dua-hat-lanh',5,N'Sữa hạt không đường',N'200',N'ml'),
 (N'mapping-2026-014-sinh-to-cai-bo-xoi-dua-hat-lanh',6,N'Nước đá',N'1',N'phần'),
 (N'mapping-2026-015-burger-dau-den-yen-mach',1,N'Đậu đen nấu chín',N'220',N'g'),
 (N'mapping-2026-015-burger-dau-den-yen-mach',2,N'Yến mạch cán',N'50',N'g'),
 (N'mapping-2026-015-burger-dau-den-yen-mach',3,N'Hành tây',N'50',N'g'),
 (N'mapping-2026-015-burger-dau-den-yen-mach',4,N'Hạt lanh xay',N'10',N'g'),
 (N'mapping-2026-015-burger-dau-den-yen-mach',5,N'Bột paprika và tiêu',N'1',N'phần'),
 (N'mapping-2026-015-burger-dau-den-yen-mach',6,N'Bánh burger và rau ăn kèm',N'2',N'phần'),
 (N'mapping-2026-017-sup-rong-bien-dau-phu-non',1,N'Rong biển khô',N'8',N'g'),
 (N'mapping-2026-017-sup-rong-bien-dau-phu-non',2,N'Đậu phụ non',N'200',N'g'),
 (N'mapping-2026-017-sup-rong-bien-dau-phu-non',3,N'Nấm kim châm',N'80',N'g'),
 (N'mapping-2026-017-sup-rong-bien-dau-phu-non',4,N'Nước dùng rau củ',N'500',N'ml'),
 (N'mapping-2026-017-sup-rong-bien-dau-phu-non',5,N'Nước tương',N'15',N'ml'),
 (N'mapping-2026-017-sup-rong-bien-dau-phu-non',6,N'Tỏi, dầu mè và hành lá',N'1',N'phần'),
 (N'mapping-2026-018-com-cari-xanh-thai-rau-cu',1,N'Cơm gạo lứt đã nấu',N'300',N'g'),
 (N'mapping-2026-018-com-cari-xanh-thai-rau-cu',2,N'Nước cốt dừa',N'180',N'ml'),
 (N'mapping-2026-018-com-cari-xanh-thai-rau-cu',3,N'Bột cà ri xanh chay',N'25',N'g'),
 (N'mapping-2026-018-com-cari-xanh-thai-rau-cu',4,N'Đậu hũ',N'150',N'g'),
 (N'mapping-2026-018-com-cari-xanh-thai-rau-cu',5,N'Bí đỏ và ớt chuông',N'180',N'g'),
 (N'mapping-2026-018-com-cari-xanh-thai-rau-cu',6,N'Đậu que và húng quế',N'1',N'phần')
) v(slug, sort_order, ingredient_name, quantity, unit)
JOIN dbo.contents c ON c.slug = v.slug AND c.content_type = N'BLOG';

INSERT INTO dbo.content_recipe_steps (content_id, step_number, instruction)
SELECT c.content_id, v.step_number, v.instruction
FROM (VALUES
 (N'mapping-2026-001-banh-xeo-chay-nam-moi',1,N'Ngâm đậu xanh cho mềm rồi hấp chín; sơ chế nấm, giá và rau sống.'),
 (N'mapping-2026-001-banh-xeo-chay-nam-moi',2,N'Khuấy bột bánh xèo với nước cốt dừa và nước đến khi hỗn hợp mịn, để bột nghỉ khoảng 15 phút.'),
 (N'mapping-2026-001-banh-xeo-chay-nam-moi',3,N'Xào nấm với chút gia vị. Làm nóng chảo, thêm dầu, tráng một lớp bột mỏng rồi cho nấm, đậu xanh và giá vào một nửa mặt bánh.'),
 (N'mapping-2026-001-banh-xeo-chay-nam-moi',4,N'Đậy nắp đến khi bánh chín và viền giòn, gập đôi rồi dùng nóng cùng rau sống.'),
 (N'mapping-2026-002-bun-mam-chay-mien-tay',1,N'Sơ chế cà tím, dứa, đậu hũ và sả; cắt nguyên liệu thành miếng vừa ăn.'),
 (N'mapping-2026-002-bun-mam-chay-mien-tay',2,N'Phi thơm sả, cho chao hoặc mắm đậu chay vào đảo nhẹ rồi thêm nước và dứa, nấu để nước dùng dậy mùi.'),
 (N'mapping-2026-002-bun-mam-chay-mien-tay',3,N'Thêm cà tím và đậu hũ, nấu đến khi mềm; nêm nước dùng vừa khẩu vị.'),
 (N'mapping-2026-002-bun-mam-chay-mien-tay',4,N'Trụng bún, xếp vào tô, chan nước dùng cùng phần rau củ và dùng với rau sống.'),
 (N'mapping-2026-003-banh-uot-cha-lua-chay',1,N'Trộn bột gạo và bột năng với nước, khuấy tan rồi để hỗn hợp nghỉ khoảng 15 phút.'),
 (N'mapping-2026-003-banh-uot-cha-lua-chay',2,N'Thái chả lụa chay, dưa leo và rau thơm; pha nước chấm từ nước tương, giấm và đường.'),
 (N'mapping-2026-003-banh-uot-cha-lua-chay',3,N'Tráng từng lớp bột mỏng trong chảo chống dính hoặc xửng hấp đến khi bánh trong và chín.'),
 (N'mapping-2026-003-banh-uot-cha-lua-chay',4,N'Cuộn hoặc xếp bánh ướt cùng chả chay, dưa leo và rau thơm; dùng với nước chấm đã pha.'),
 (N'mapping-2026-004-sua-hat-dieu-cacao',1,N'Ngâm hạt điều trong nước ấm khoảng 2 giờ rồi rửa sạch và để ráo.'),
 (N'mapping-2026-004-sua-hat-dieu-cacao',2,N'Cho hạt điều, nước lọc, cacao, chất tạo ngọt và một nhúm muối vào máy xay.'),
 (N'mapping-2026-004-sua-hat-dieu-cacao',3,N'Xay hỗn hợp đến khi thật mịn; lọc qua túi lọc nếu muốn thức uống mượt hơn.'),
 (N'mapping-2026-004-sua-hat-dieu-cacao',4,N'Rót ra ly, dùng lạnh hoặc bảo quản trong chai kín ở ngăn mát và lắc đều trước khi uống.'),
 (N'mapping-2026-005-kimbap-gao-lut-bo-sap',1,N'Nấu chín gạo lứt, để nguội bớt rồi trộn nhẹ với một ít muối và dầu mè.'),
 (N'mapping-2026-005-kimbap-gao-lut-bo-sap',2,N'Áp chảo đậu hũ; thái bơ, cà rốt và dưa leo thành thanh dài.'),
 (N'mapping-2026-005-kimbap-gao-lut-bo-sap',3,N'Đặt rong biển lên mành cuốn, dàn cơm thành lớp mỏng rồi xếp đậu hũ và rau củ ở một mép.'),
 (N'mapping-2026-005-kimbap-gao-lut-bo-sap',4,N'Cuộn chặt tay, làm ẩm mép rong biển để dính, cắt khoanh vừa ăn và dùng ngay.'),
 (N'mapping-2026-006-dau-hu-tu-xuyen-chay',1,N'Thái nấm, băm tỏi và gừng; hòa bột bắp với một ít nước.'),
 (N'mapping-2026-006-dau-hu-tu-xuyen-chay',2,N'Phi thơm tỏi gừng, thêm tương đậu cay chay và nấm, đảo đến khi nấm mềm.'),
 (N'mapping-2026-006-dau-hu-tu-xuyen-chay',3,N'Thêm nước và đậu hũ non cắt miếng, đun lửa nhỏ để đậu nóng mà không vỡ.'),
 (N'mapping-2026-006-dau-hu-tu-xuyen-chay',4,N'Rưới nước bột bắp để sốt sánh nhẹ, thêm dầu mè và hành lá rồi dùng nóng.'),
 (N'mapping-2026-008-canh-chua-nam-bong-dien-dien',1,N'Rửa sạch nấm, bông điên điển, cà chua và dứa; pha nước me với nước ấm.'),
 (N'mapping-2026-008-canh-chua-nam-bong-dien-dien',2,N'Đun nước, cho dứa và cà chua vào nấu vài phút để tạo vị ngọt và màu nước canh.'),
 (N'mapping-2026-008-canh-chua-nam-bong-dien-dien',3,N'Thêm nước me và nấm, nêm muối hoặc nước tương; khi nấm gần chín thì cho bông điên điển vào.'),
 (N'mapping-2026-008-canh-chua-nam-bong-dien-dien',4,N'Tắt bếp khi rau vừa chín, thêm rau om và ngò gai, dùng nóng.'),
 (N'mapping-2026-009-mi-udon-xao-nam-dong-co',1,N'Tách sợi mì udon, thái nấm và đậu hũ; sơ chế bông cải xanh.'),
 (N'mapping-2026-009-mi-udon-xao-nam-dong-co',2,N'Chần mì nhanh qua nước nóng nếu cần, sau đó để ráo.'),
 (N'mapping-2026-009-mi-udon-xao-nam-dong-co',3,N'Xào nấm và đậu hũ, thêm bông cải cùng một ít nước đến khi rau vừa mềm.'),
 (N'mapping-2026-009-mi-udon-xao-nam-dong-co',4,N'Cho mì, nước tương và sốt teriyaki chay vào chảo, đảo đều rồi dùng nóng.'),
 (N'mapping-2026-010-mi-y-pesto-hung-que-hat-thong',1,N'Luộc mì Ý trong nước sôi có muối theo thời gian trên bao bì; giữ lại một ít nước luộc mì.'),
 (N'mapping-2026-010-mi-y-pesto-hung-que-hat-thong',2,N'Xay húng quế, hạt thông, tỏi, dầu ô liu, men dinh dưỡng và nước cốt chanh thành sốt Pesto.'),
 (N'mapping-2026-010-mi-y-pesto-hung-que-hat-thong',3,N'Trộn mì đã ráo với sốt; thêm từng ít nước luộc mì để sốt bám đều.'),
 (N'mapping-2026-010-mi-y-pesto-hung-que-hat-thong',4,N'Nếm lại gia vị, rắc thêm hạt thông và dùng ngay.'),
 (N'mapping-2026-012-goi-ngo-sen-dau-hu-chien',1,N'Rửa ngó sen, cắt khúc vừa ăn và ngâm nhanh với nước pha chanh để giữ độ giòn.'),
 (N'mapping-2026-012-goi-ngo-sen-dau-hu-chien',2,N'Chiên hoặc áp chảo đậu hũ đến khi vàng, để ráo dầu rồi cắt miếng.'),
 (N'mapping-2026-012-goi-ngo-sen-dau-hu-chien',3,N'Pha giấm, đường và nước tương; trộn ngó sen với cà rốt cùng nước trộn, để thấm khoảng 10 phút.'),
 (N'mapping-2026-012-goi-ngo-sen-dau-hu-chien',4,N'Cho đậu hũ và rau răm vào trộn nhẹ, rắc đậu phộng rang trước khi dùng.'),
 (N'mapping-2026-013-pad-thai-dau-hu-sot-me',1,N'Ngâm bánh phở đến khi mềm vừa, để ráo; pha nước me với nước tương và đường thốt nốt.'),
 (N'mapping-2026-013-pad-thai-dau-hu-sot-me',2,N'Áp chảo đậu hũ, để riêng; xào giá và hẹ nhanh trên lửa lớn.'),
 (N'mapping-2026-013-pad-thai-dau-hu-sot-me',3,N'Cho bánh phở và sốt me vào chảo, đảo đến khi sợi mềm và thấm sốt; thêm đậu hũ.'),
 (N'mapping-2026-013-pad-thai-dau-hu-sot-me',4,N'Dùng nóng với đậu phộng rang, hẹ và chanh.'),
 (N'mapping-2026-014-sinh-to-cai-bo-xoi-dua-hat-lanh',1,N'Rửa cải bó xôi, gọt và cắt dứa, bóc chuối.'),
 (N'mapping-2026-014-sinh-to-cai-bo-xoi-dua-hat-lanh',2,N'Cho cải bó xôi, dứa, chuối, hạt lanh xay và sữa hạt vào máy xay.'),
 (N'mapping-2026-014-sinh-to-cai-bo-xoi-dua-hat-lanh',3,N'Xay đến khi hỗn hợp mịn; thêm nước hoặc đá để điều chỉnh độ sánh.'),
 (N'mapping-2026-014-sinh-to-cai-bo-xoi-dua-hat-lanh',4,N'Rót ra ly và dùng ngay để giữ hương vị tươi.'),
 (N'mapping-2026-015-burger-dau-den-yen-mach',1,N'Nghiền thô đậu đen đã nấu chín, giữ lại một phần hạt để tạo kết cấu.'),
 (N'mapping-2026-015-burger-dau-den-yen-mach',2,N'Trộn đậu với yến mạch, hành tây băm, hạt lanh và gia vị; để hỗn hợp nghỉ 10 phút.'),
 (N'mapping-2026-015-burger-dau-den-yen-mach',3,N'Nặn thành hai miếng burger, áp chảo mỗi mặt đến khi vàng và nóng đều bên trong.'),
 (N'mapping-2026-015-burger-dau-den-yen-mach',4,N'Kẹp burger với bánh mì và rau ăn kèm, dùng khi còn ấm.'),
 (N'mapping-2026-017-sup-rong-bien-dau-phu-non',1,N'Ngâm rong biển khô trong nước mát vài phút, rửa nấm và cắt đậu phụ thành miếng.'),
 (N'mapping-2026-017-sup-rong-bien-dau-phu-non',2,N'Phi thơm tỏi với một ít dầu mè, thêm nước dùng rau củ và đun sôi nhẹ.'),
 (N'mapping-2026-017-sup-rong-bien-dau-phu-non',3,N'Cho rong biển và nấm vào nồi, nấu vài phút rồi thêm đậu phụ non.'),
 (N'mapping-2026-017-sup-rong-bien-dau-phu-non',4,N'Nêm nước tương vừa ăn, rắc hành lá và dùng nóng.'),
 (N'mapping-2026-018-com-cari-xanh-thai-rau-cu',1,N'Cắt đậu hũ, bí đỏ và ớt chuông thành miếng vừa ăn; rửa sạch đậu que và húng quế.'),
 (N'mapping-2026-018-com-cari-xanh-thai-rau-cu',2,N'Phi thơm cà ri xanh chay với một ít nước cốt dừa để dậy mùi.'),
 (N'mapping-2026-018-com-cari-xanh-thai-rau-cu',3,N'Thêm phần nước cốt dừa còn lại, bí đỏ và đậu hũ; nấu đến khi bí gần mềm rồi cho ớt chuông và đậu que vào.'),
 (N'mapping-2026-018-com-cari-xanh-thai-rau-cu',4,N'Nêm vừa ăn, thêm húng quế rồi dùng cà ri nóng cùng cơm gạo lứt.')
) v(slug, step_number, instruction)
JOIN dbo.contents c ON c.slug = v.slug AND c.content_type = N'BLOG';

-- Engagement is attached only to published content. The two videos without a
-- playable URL remain drafts and deliberately receive no public interaction.
DECLARE @PublicPosts TABLE (
    slug NVARCHAR(280) NOT NULL PRIMARY KEY,
    published_at DATETIME2(3) NOT NULL,
    baseline_views INT NOT NULL,
    comment_one NVARCHAR(500) NOT NULL,
    comment_two NVARCHAR(500) NOT NULL
);

INSERT INTO @PublicPosts VALUES
(N'mapping-2026-001-banh-xeo-chay-nam-moi', '2026-11-06T09:42:00', 284, N'Vỏ bánh giòn cùng phần nhân nấm nghe hấp dẫn quá!', N'Mình sẽ thử thêm giá và rau thơm như gợi ý.'),
(N'mapping-2026-002-bun-mam-chay-mien-tay', '2026-11-10T16:13:00', 731, N'Rất nhớ hương vị miền Tây, phiên bản chay này lạ mà cuốn.', N'Có thể gia giảm chao theo khẩu vị gia đình nữa.'),
(N'mapping-2026-003-banh-uot-cha-lua-chay', '2026-11-11T08:27:00', 163, N'Món này làm bữa sáng chắc vừa nhẹ bụng vừa ngon.', N'Nước chấm chua ngọt ăn cùng bánh ướt là hợp nhất.'),
(N'mapping-2026-004-sua-hat-dieu-cacao', '2026-11-13T13:54:00', 508, N'Hạt điều với cacao là sự kết hợp mình chưa thử bao giờ.', N'Thích công thức ít ngọt, có thể dùng lạnh chắc ngon.'),
(N'mapping-2026-005-kimbap-gao-lut-bo-sap', '2026-11-14T07:35:00', 946, N'Bơ sáp cuộn với gạo lứt nghe béo bùi quá.', N'Món này tiện chuẩn bị cho hộp cơm mang đi làm.'),
(N'mapping-2026-006-dau-hu-tu-xuyen-chay', '2026-11-14T18:22:00', 372, N'Đậu hũ non sốt cay ăn cùng cơm nóng là hết ý.', N'Mình sẽ giảm tương cay một chút cho cả nhà.'),
(N'mapping-2026-008-canh-chua-nam-bong-dien-dien', '2026-11-15T20:11:00', 618, N'Bông điên điển nấu canh chua gợi nhớ món quê nhà.', N'Thêm chút rau om cuối cùng là thơm đúng vị.'),
(N'mapping-2026-009-mi-udon-xao-nam-dong-co', '2026-11-15T09:18:00', 92, N'Mì udon dai xào với nấm là món mình hay gọi ở quán.', N'Sốt teriyaki chay làm món này có màu đẹp ghê.'),
(N'mapping-2026-010-mi-y-pesto-hung-que-hat-thong', '2026-11-15T15:46:00', 807, N'Húng quế và hạt thông làm sốt pesto thơm đặc trưng.', N'Có thể thay hạt thông bằng hạt điều không nhỉ?'),
(N'mapping-2026-012-goi-ngo-sen-dau-hu-chien', '2026-11-16T12:31:00', 451, N'Ngó sen giòn ăn cùng đậu hũ chiên rất bắt vị.', N'Món khai vị này có đủ chua ngọt và rau thơm.'),
(N'mapping-2026-013-pad-thai-dau-hu-sot-me', '2026-11-17T19:05:00', 990, N'Sốt me chua nhẹ chắc cân bằng vị rất tốt.', N'Rắc thêm đậu phộng rang là chuẩn bài Pad Thai.'),
(N'mapping-2026-014-sinh-to-cai-bo-xoi-dua-hat-lanh', '2026-11-17T08:12:00', 239, N'Dứa và chuối giúp sinh tố rau xanh dễ uống hơn.', N'Mình thường thêm đá xay để thức uống mát hơn.'),
(N'mapping-2026-015-burger-dau-den-yen-mach', '2026-11-18T14:27:00', 684, N'Burger đậu đen là lựa chọn nhiều chất xơ mình thích.', N'Yến mạch giúp miếng burger kết dính tự nhiên hay quá.'),
(N'mapping-2026-016-sot-tron-salad-thuan-chay-video', '2026-11-18T10:02:00', 127, N'Ba loại sốt trộn salad giúp đổi vị cho cả tuần.', N'Video hướng dẫn ngắn gọn, dễ lưu lại để làm theo.'),
(N'mapping-2026-017-sup-rong-bien-dau-phu-non', '2026-11-19T21:38:00', 571, N'Súp rong biển nóng rất hợp cho bữa tối nhẹ nhàng.', N'Đậu phụ non và nấm kim châm nấu cùng nhau ngon lắm.'),
(N'mapping-2026-018-com-cari-xanh-thai-rau-cu', '2026-11-20T07:44:00', 346, N'Cà ri xanh cốt dừa ăn với gạo lứt nghe thật hợp.', N'Rau củ nhiều màu làm món ăn trông hấp dẫn hơn.');

-- Five positive votes per public post from active USER accounts (IDs 13-17).
INSERT INTO dbo.votes (user_id, content_id, vote_value, created_at)
SELECT v.user_id, c.content_id, 1, DATEADD(MINUTE, v.minutes_after_publish, p.published_at)
FROM @PublicPosts p
JOIN dbo.contents c ON c.slug = p.slug AND c.status = N'published'
CROSS APPLY (VALUES
    (13, 18), (14, 97), (15, 163), (16, 291), (17, 529)
) v(user_id, minutes_after_publish)
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.votes existing
    WHERE existing.user_id = v.user_id AND existing.content_id = c.content_id
);

-- Two contextual comments per public post, authored by regular accounts.
INSERT INTO dbo.comments (user_id, content_id, parent_id, body, status, created_at, updated_at)
SELECT v.user_id, c.content_id, NULL, v.body, N'published',
       DATEADD(MINUTE, v.minutes_after_publish, p.published_at),
       DATEADD(MINUTE, v.minutes_after_publish, p.published_at)
FROM @PublicPosts p
JOIN dbo.contents c ON c.slug = p.slug AND c.status = N'published'
CROSS APPLY (VALUES
    (11, 143, p.comment_one), (12, 629, p.comment_two)
) v(user_id, minutes_after_publish, body)
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.comments existing
    WHERE existing.content_id = c.content_id
      AND existing.user_id = v.user_id
      AND existing.body = v.body
);

-- Six varied view sessions per public post. Stable timestamps make reruns idempotent.
INSERT INTO dbo.content_view_events
    (user_id, content_id, started_at, last_active_at, ended_at, dwell_time_sec, max_scroll_pct, completed)
SELECT v.user_id, c.content_id,
       DATEADD(MINUTE, v.minutes_after_publish, p.published_at),
       DATEADD(SECOND, v.dwell_time_sec, DATEADD(MINUTE, v.minutes_after_publish, p.published_at)),
       DATEADD(SECOND, v.dwell_time_sec, DATEADD(MINUTE, v.minutes_after_publish, p.published_at)),
       v.dwell_time_sec, v.max_scroll_pct, CASE WHEN v.max_scroll_pct >= 90 THEN 1 ELSE 0 END
FROM @PublicPosts p
JOIN dbo.contents c ON c.slug = p.slug AND c.status = N'published'
CROSS APPLY (VALUES
    (11, 31, 42, 38.00), (12, 119, 67, 56.00), (13, 284, 35, 24.00),
    (14, 391, 91, 94.00), (15, 506, 58, 72.00), (16, 833, 112, 100.00)
) v(user_id, minutes_after_publish, dwell_time_sec, max_scroll_pct)
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.content_view_events existing
    WHERE existing.user_id = v.user_id
      AND existing.content_id = c.content_id
      AND existing.started_at = DATEADD(MINUTE, v.minutes_after_publish, p.published_at)
);

-- Keep the denormalized counter equal to the supplied baseline plus event rows.
-- Recalculation makes reruns stable and avoids accumulating duplicate counts.
UPDATE c
SET view_count = p.baseline_views + event_totals.total_views
FROM dbo.contents c
JOIN @PublicPosts p ON p.slug = c.slug
CROSS APPLY (
    SELECT COUNT_BIG(*) AS total_views
    FROM dbo.content_view_events e
    WHERE e.content_id = c.content_id
) event_totals;

COMMIT TRANSACTION;
GO
