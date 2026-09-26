-- =============================================
-- NutriBotV2 - SAMPLE DATA (FIXED)
-- Schema gốc của bạn – không đổi DB
-- Roles: Admin | User
-- Không phụ thuộc IDENTITY = 1..50
-- =============================================

USE NutriBotV2;
GO

SET NOCOUNT ON;

------------------------------------------------
-- 0. XÓA SẠCH DATA CŨ
------------------------------------------------
DELETE FROM content_moderations;
DELETE FROM chat_messages;
DELETE FROM chat_sessions;
DELETE FROM restaurant_dishes;
DELETE FROM restaurants;
DELETE FROM weekly_menu_items;
DELETE FROM weekly_menu_meals;
DELETE FROM weekly_menus;
DELETE FROM votes;
DELETE FROM comments;
DELETE FROM contents;
DELETE FROM recipe_ingredients;
DELETE FROM recipes;
DELETE FROM dishes;
DELETE FROM user_allergies;
DELETE FROM ingredients;
DELETE FROM categories;
DELETE FROM user_profiles;
DELETE FROM users;
DELETE FROM roles;
GO

------------------------------------------------
-- 1. ROLES
------------------------------------------------
INSERT INTO roles (role_name, description) VALUES
(N'Admin', N'System administrator with full access'),
(N'User',  N'Regular registered user');
GO

DECLARE @AdminRoleId INT = (SELECT TOP 1 role_id FROM roles WHERE role_name = N'Admin');
DECLARE @UserRoleId  INT = (SELECT TOP 1 role_id FROM roles WHERE role_name = N'User');
GO

------------------------------------------------
-- 2. USERS (50)
------------------------------------------------
DECLARE @AdminRoleId INT = (SELECT TOP 1 role_id FROM roles WHERE role_name = N'Admin');
DECLARE @UserRoleId  INT = (SELECT TOP 1 role_id FROM roles WHERE role_name = N'User');
DECLARE @i INT = 1;

WHILE @i <= 50
BEGIN
    INSERT INTO users (username, email, password_hash, full_name, avatar_url, bio, role_id, strike_count, status)
    VALUES (
        N'user' + CAST(@i AS NVARCHAR(10)),
        N'user' + CAST(@i AS NVARCHAR(10)) + N'@nutribot.vn',
        N'$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEF',
        N'Nguyễn Văn ' + CAST(@i AS NVARCHAR(10)),
        N'https://i.pravatar.cc/150?img=' + CAST((@i % 70 + 1) AS NVARCHAR(10)),
        N'Thành viên NutriBot chia sẻ hành trình ăn uống lành mạnh số ' + CAST(@i AS NVARCHAR(10)),
        CASE WHEN @i <= 3 THEN @AdminRoleId ELSE @UserRoleId END,
        CASE WHEN @i % 17 = 0 THEN 1 WHEN @i % 23 = 0 THEN 2 ELSE 0 END,
        N'ACTIVE'
    );
    SET @i += 1;
END
GO

------------------------------------------------
-- 3. USER_PROFILES (theo user_id thực tế)
------------------------------------------------
INSERT INTO user_profiles (user_id, height_cm, weight_kg, gender, date_of_birth, health_goal)
SELECT
    u.user_id,
    155 + (u.user_id % 30),
    45 + (u.user_id % 40),
    CASE WHEN u.user_id % 3 = 0 THEN N'Female' WHEN u.user_id % 3 = 1 THEN N'Male' ELSE N'Other' END,
    DATEADD(YEAR, -18 - (u.user_id % 40), '2000-01-01'),
    CASE u.user_id % 3 WHEN 0 THEN N'lose_weight' WHEN 1 THEN N'gain_muscle' ELSE N'maintain' END
FROM users u;
GO

------------------------------------------------
-- 4. CATEGORIES (31)
------------------------------------------------
INSERT INTO categories (name, slug, description, category_type) VALUES
(N'Rau củ', N'rau-cu', N'Rau xanh và củ quả', N'INGREDIENT'),
(N'Thịt', N'thit', N'Thịt các loại', N'INGREDIENT'),
(N'Hải sản', N'hai-san', N'Cá, tôm, mực...', N'INGREDIENT'),
(N'Trái cây', N'trai-cay', N'Trái cây tươi', N'INGREDIENT'),
(N'Ngũ cốc', N'ngu-coc', N'Gạo, mì, yến mạch...', N'INGREDIENT'),
(N'Sữa & Trứng', N'sua-trung', N'Sữa, trứng, phô mai', N'INGREDIENT'),
(N'Gia vị', N'gia-vi', N'Gia vị, nước mắm, muối...', N'INGREDIENT'),
(N'Dầu & Chất béo', N'dau-chat-beo', N'Dầu ăn, bơ, mỡ', N'INGREDIENT'),
(N'Hạt & Đậu', N'hat-dau', N'Hạt điều, đậu nành, đậu đen...', N'INGREDIENT'),
(N'Đồ khô', N'do-kho', N'Mì gói, bánh mì, đồ khô', N'INGREDIENT'),
(N'Nấm', N'nam', N'Các loại nấm', N'INGREDIENT'),
(N'Đồ uống', N'do-uong', N'Trà, cà phê, nước ép', N'INGREDIENT'),
(N'Đồ chua', N'do-chua', N'Dưa chua, kim chi', N'INGREDIENT'),
(N'Bột & Tinh bột', N'bot-tinh-bot', N'Bột mì, bột gạo, tinh bột', N'INGREDIENT'),
(N'Đồ ngọt', N'do-ngot', N'Đường, mật ong, siro', N'INGREDIENT'),
(N'Món Việt', N'mon-viet', N'Các món ăn truyền thống Việt Nam', N'RECIPE'),
(N'Món Á', N'mon-a', N'Món ăn châu Á', N'RECIPE'),
(N'Món Âu', N'mon-au', N'Món ăn châu Âu', N'RECIPE'),
(N'Salad & Healthy', N'salad-healthy', N'Salad và món healthy', N'RECIPE'),
(N'Soup', N'soup', N'Các loại súp', N'RECIPE'),
(N'Món chay', N'mon-chay', N'Món ăn chay', N'RECIPE'),
(N'Món sáng', N'mon-sang', N'Món ăn sáng', N'RECIPE'),
(N'Món tráng miệng', N'mon-trang-mieng', N'Tráng miệng, dessert', N'RECIPE'),
(N'Món nướng', N'mon-nuong', N'Món nướng BBQ', N'RECIPE'),
(N'Món hấp', N'mon-hap', N'Món hấp', N'RECIPE'),
(N'Món xào', N'mon-xao', N'Món xào', N'RECIPE'),
(N'Món canh', N'mon-canh', N'Canh các loại', N'RECIPE'),
(N'Món kho', N'mon-kho', N'Món kho', N'RECIPE'),
(N'Món chiên', N'mon-chien', N'Món chiên', N'RECIPE'),
(N'Món cuốn', N'mon-cuon', N'Gỏi cuốn, nem...', N'RECIPE'),
(N'Đồ uống healthy', N'do-uong-healthy', N'Nước ép, smoothie', N'RECIPE');
GO

------------------------------------------------
-- 5. INGREDIENTS (50) – category_id theo slug thực tế
------------------------------------------------
DECLARE @catRau INT = (SELECT category_id FROM categories WHERE slug = N'rau-cu');
DECLARE @catThit INT = (SELECT category_id FROM categories WHERE slug = N'thit');
DECLARE @catHaiSan INT = (SELECT category_id FROM categories WHERE slug = N'hai-san');
DECLARE @catTraiCay INT = (SELECT category_id FROM categories WHERE slug = N'trai-cay');
DECLARE @catNguCoc INT = (SELECT category_id FROM categories WHERE slug = N'ngu-coc');
DECLARE @catSua INT = (SELECT category_id FROM categories WHERE slug = N'sua-trung');
DECLARE @catGiaVi INT = (SELECT category_id FROM categories WHERE slug = N'gia-vi');
DECLARE @catDau INT = (SELECT category_id FROM categories WHERE slug = N'dau-chat-beo');
DECLARE @catHat INT = (SELECT category_id FROM categories WHERE slug = N'hat-dau');
DECLARE @catDoKho INT = (SELECT category_id FROM categories WHERE slug = N'do-kho');
DECLARE @catNam INT = (SELECT category_id FROM categories WHERE slug = N'nam');
DECLARE @catDoUong INT = (SELECT category_id FROM categories WHERE slug = N'do-uong');
DECLARE @catDoNgot INT = (SELECT category_id FROM categories WHERE slug = N'do-ngot');

INSERT INTO ingredients (name, slug, description, category_id) VALUES
(N'Cà chua', N'ca-chua', N'Cà chua tươi', @catRau),
(N'Hành tây', N'hanh-tay', N'Hành tây', @catRau),
(N'Cà rốt', N'ca-rot', N'Cà rốt', @catRau),
(N'Rau cải', N'rau-cai', N'Rau cải xanh', @catRau),
(N'Bắp cải', N'bap-cai', N'Bắp cải', @catRau),
(N'Khoai tây', N'khoai-tay', N'Khoai tây', @catRau),
(N'Hành lá', N'hanh-la', N'Hành lá', @catRau),
(N'Rau thơm', N'rau-thom', N'Rau thơm hỗn hợp', @catRau),
(N'Ớt', N'ot', N'Ớt cay', @catRau),
(N'Gừng', N'gung', N'Gừng tươi', @catRau),
(N'Thịt heo', N'thit-heo', N'Thịt heo tươi', @catThit),
(N'Thịt bò', N'thit-bo', N'Thịt bò', @catThit),
(N'Thịt gà', N'thit-ga', N'Thịt gà', @catThit),
(N'Sườn non', N'suon-non', N'Sườn non heo', @catThit),
(N'Thịt ba chỉ', N'thit-ba-chi', N'Thịt ba chỉ', @catThit),
(N'Cá basa', N'ca-basa', N'Cá basa fillet', @catHaiSan),
(N'Cá hồi', N'ca-hoi', N'Cá hồi Na Uy', @catHaiSan),
(N'Tôm sú', N'tom-su', N'Tôm sú tươi', @catHaiSan),
(N'Mực ống', N'muc-ong', N'Mực ống', @catHaiSan),
(N'Cua', N'cua', N'Cua biển', @catHaiSan),
(N'Táo', N'tao', N'Táo đỏ', @catTraiCay),
(N'Chuối', N'chuoi', N'Chuối tiêu', @catTraiCay),
(N'Cam', N'cam', N'Cam sành', @catTraiCay),
(N'Dưa hấu', N'dua-hau', N'Dưa hấu', @catTraiCay),
(N'Xoài', N'xoai', N'Xoài cát', @catTraiCay),
(N'Gạo trắng', N'gao-trang', N'Gạo trắng hạt dài', @catNguCoc),
(N'Gạo lứt', N'gao-lut', N'Gạo lứt hữu cơ', @catNguCoc),
(N'Mì Ý', N'mi-y', N'Mì spaghetti', @catNguCoc),
(N'Yến mạch', N'yen-mach', N'Yến mạch cán dẹt', @catNguCoc),
(N'Bún tươi', N'bun-tuoi', N'Bún tươi', @catNguCoc),
(N'Trứng gà', N'trung-ga', N'Trứng gà ta', @catSua),
(N'Sữa tươi', N'sua-tuoi', N'Sữa tươi không đường', @catSua),
(N'Phô mai', N'pho-mai', N'Phô mai mozzarella', @catSua),
(N'Sữa chua', N'sua-chua', N'Sữa chua Hy Lạp', @catSua),
(N'Nước mắm', N'nuoc-mam', N'Nước mắm Phú Quốc', @catGiaVi),
(N'Muối', N'muoi', N'Muối biển', @catGiaVi),
(N'Đường', N'duong', N'Đường cát trắng', @catGiaVi),
(N'Tiêu', N'tieu', N'Tiêu đen xay', @catGiaVi),
(N'Dầu olive', N'dau-olive', N'Dầu olive extra virgin', @catDau),
(N'Dầu ăn', N'dau-an', N'Dầu thực vật', @catDau),
(N'Bơ', N'bo', N'Bơ lạt', @catDau),
(N'Hạt điều', N'hat-dieu', N'Hạt điều rang', @catHat),
(N'Đậu nành', N'dau-nanh', N'Đậu nành', @catHat),
(N'Đậu đen', N'dau-den', N'Đậu đen', @catHat),
(N'Mì gói', N'mi-goi', N'Mì ăn liền', @catDoKho),
(N'Bánh mì', N'banh-mi', N'Bánh mì baguette', @catDoKho),
(N'Nấm hương', N'nam-huong', N'Nấm hương khô', @catNam),
(N'Nấm rơm', N'nam-rom', N'Nấm rơm tươi', @catNam),
(N'Trà xanh', N'tra-xanh', N'Trà xanh túi lọc', @catDoUong),
(N'Mật ong', N'mat-ong', N'Mật ong rừng', @catDoNgot);
GO

------------------------------------------------
-- 6. USER_ALLERGIES
------------------------------------------------
;WITH U AS (
    SELECT user_id, ROW_NUMBER() OVER (ORDER BY user_id) AS rn FROM users
),
I AS (
    SELECT ingredient_id, ROW_NUMBER() OVER (ORDER BY ingredient_id) AS rn FROM ingredients
)
INSERT INTO user_allergies (user_id, ingredient_id)
SELECT u.user_id, i.ingredient_id
FROM U u
CROSS JOIN I i
WHERE (u.rn % 2 = 0 AND i.rn = ((u.rn * 3) % 50) + 1)
   OR (u.rn % 3 = 0 AND i.rn = ((u.rn * 5) % 50) + 1)
   OR (u.rn % 5 = 0 AND i.rn = ((u.rn * 7) % 50) + 1);
GO

------------------------------------------------
-- 7. DISHES (50) – category RECIPE theo slug
------------------------------------------------
DECLARE @catViet INT = (SELECT category_id FROM categories WHERE slug = N'mon-viet');
DECLARE @catA INT = (SELECT category_id FROM categories WHERE slug = N'mon-a');
DECLARE @catAu INT = (SELECT category_id FROM categories WHERE slug = N'mon-au');
DECLARE @catSalad INT = (SELECT category_id FROM categories WHERE slug = N'salad-healthy');
DECLARE @catSoup INT = (SELECT category_id FROM categories WHERE slug = N'soup');
DECLARE @catChay INT = (SELECT category_id FROM categories WHERE slug = N'mon-chay');
DECLARE @catSang INT = (SELECT category_id FROM categories WHERE slug = N'mon-sang');
DECLARE @catTrangMieng INT = (SELECT category_id FROM categories WHERE slug = N'mon-trang-mieng');
DECLARE @catNuong INT = (SELECT category_id FROM categories WHERE slug = N'mon-nuong');
DECLARE @catHap INT = (SELECT category_id FROM categories WHERE slug = N'mon-hap');
DECLARE @catXao INT = (SELECT category_id FROM categories WHERE slug = N'mon-xao');
DECLARE @catCanh INT = (SELECT category_id FROM categories WHERE slug = N'mon-canh');
DECLARE @catKho INT = (SELECT category_id FROM categories WHERE slug = N'mon-kho');
DECLARE @catChien INT = (SELECT category_id FROM categories WHERE slug = N'mon-chien');
DECLARE @catCuon INT = (SELECT category_id FROM categories WHERE slug = N'mon-cuon');
DECLARE @catDoUongH INT = (SELECT category_id FROM categories WHERE slug = N'do-uong-healthy');

INSERT INTO dishes (name, slug, description, image_url, category_id, calories, protein_g) VALUES
(N'Phở bò', N'pho-bo', N'Phở bò Hà Nội truyền thống', N'https://example.com/pho-bo.jpg', @catViet, 450, 28.5),
(N'Bún chả', N'bun-cha', N'Bún chả Hà Nội', N'https://example.com/bun-cha.jpg', @catViet, 520, 32.0),
(N'Cơm tấm sườn', N'com-tam-suon', N'Cơm tấm sườn nướng Sài Gòn', N'https://example.com/com-tam.jpg', @catViet, 680, 35.0),
(N'Gỏi cuốn tôm thịt', N'goi-cuon-tom-thit', N'Gỏi cuốn tôm thịt tươi', N'https://example.com/goi-cuon.jpg', @catCuon, 180, 12.0),
(N'Canh chua cá', N'canh-chua-ca', N'Canh chua cá lóc miền Tây', N'https://example.com/canh-chua.jpg', @catCanh, 220, 18.0),
(N'Cá kho tộ', N'ca-kho-to', N'Cá basa kho tộ đậm đà', N'https://example.com/ca-kho.jpg', @catKho, 380, 30.0),
(N'Thịt kho tàu', N'thit-kho-tau', N'Thịt ba chỉ kho trứng', N'https://example.com/thit-kho.jpg', @catKho, 520, 28.0),
(N'Rau muống xào tỏi', N'rau-muong-xao-toi', N'Rau muống xào tỏi giòn', N'https://example.com/rau-muong.jpg', @catXao, 90, 3.5),
(N'Salad gà', N'salad-ga', N'Salad ức gà healthy', N'https://example.com/salad-ga.jpg', @catSalad, 280, 32.0),
(N'Súp bí đỏ', N'sup-bi-do', N'Súp bí đỏ kem', N'https://example.com/sup-bi.jpg', @catSoup, 210, 5.0),
(N'Mì Ý sốt cà chua', N'mi-y-sot-ca-chua', N'Spaghetti với sốt cà chua', N'https://example.com/mi-y.jpg', @catAu, 420, 14.0),
(N'Steak bò', N'steak-bo', N'Steak bò medium rare', N'https://example.com/steak.jpg', @catAu, 550, 45.0),
(N'Cơm gà xối mỡ', N'com-ga-xoi-mo', N'Cơm gà xối mỡ Hội An', N'https://example.com/com-ga.jpg', @catViet, 620, 38.0),
(N'Bánh mì thịt', N'banh-mi-thit', N'Bánh mì thịt nguội', N'https://example.com/banh-mi.jpg', @catViet, 380, 18.0),
(N'Chả cá Lã Vọng', N'cha-ca-la-vong', N'Chả cá Lã Vọng Hà Nội', N'https://example.com/cha-ca.jpg', @catViet, 480, 35.0),
(N'Bún bò Huế', N'bun-bo-hue', N'Bún bò Huế cay nồng', N'https://example.com/bun-bo.jpg', @catViet, 550, 30.0),
(N'Nem rán', N'nem-ran', N'Nem rán giòn', N'https://example.com/nem-ran.jpg', @catChien, 320, 12.0),
(N'Gà nướng mật ong', N'ga-nuong-mat-ong', N'Gà nướng mật ong thơm lừng', N'https://example.com/ga-nuong.jpg', @catNuong, 480, 42.0),
(N'Cá hồi nướng', N'ca-hoi-nuong', N'Cá hồi nướng bơ tỏi', N'https://example.com/ca-hoi.jpg', @catNuong, 420, 38.0),
(N'Tôm hấp bia', N'tom-hap-bia', N'Tôm sú hấp bia', N'https://example.com/tom-hap.jpg', @catHap, 280, 28.0),
(N'Đậu hũ sốt cà', N'dau-hu-sot-ca', N'Đậu hũ non sốt cà chua', N'https://example.com/dau-hu.jpg', @catChay, 220, 15.0),
(N'Cơm chiên Dương Châu', N'com-chien-duong-chau', N'Cơm chiên Dương Châu', N'https://example.com/com-chien.jpg', @catA, 480, 16.0),
(N'Pad Thai', N'pad-thai', N'Mì xào Pad Thai Thái', N'https://example.com/pad-thai.jpg', @catA, 520, 22.0),
(N'Kimchi Jjigae', N'kimchi-jjigae', N'Canh kimchi Hàn Quốc', N'https://example.com/kimchi.jpg', @catA, 320, 18.0),
(N'Sushi cuộn', N'sushi-cuon', N'Sushi cuộn cá hồi', N'https://example.com/sushi.jpg', @catA, 350, 20.0),
(N'Pizza Margherita', N'pizza-margherita', N'Pizza Margherita Ý', N'https://example.com/pizza.jpg', @catAu, 680, 25.0),
(N'Salad Caesar', N'salad-caesar', N'Salad Caesar cổ điển', N'https://example.com/caesar.jpg', @catSalad, 320, 18.0),
(N'Smoothie xanh', N'smoothie-xanh', N'Smoothie rau củ xanh', N'https://example.com/smoothie.jpg', @catDoUongH, 180, 8.0),
(N'Yến mạch trái cây', N'yen-mach-trai-cay', N'Yến mạch với trái cây tươi', N'https://example.com/yen-mach.jpg', @catSang, 320, 12.0),
(N'Bánh pancake', N'banh-pancake', N'Pancake mật ong', N'https://example.com/pancake.jpg', @catSang, 380, 10.0),
(N'Cháo gà', N'chao-ga', N'Cháo gà hạt sen', N'https://example.com/chao-ga.jpg', @catSang, 280, 20.0),
(N'Bún riêu', N'bun-rieu', N'Bún riêu cua', N'https://example.com/bun-rieu.jpg', @catViet, 420, 22.0),
(N'Lẩu thái', N'lau-thai', N'Lẩu thái hải sản', N'https://example.com/lau-thai.jpg', @catA, 380, 28.0),
(N'Gà kho gừng', N'ga-kho-gung', N'Gà kho gừng đậm vị', N'https://example.com/ga-kho.jpg', @catKho, 450, 40.0),
(N'Sườn xào chua ngọt', N'suon-xao-chua-ngot', N'Sườn non xào chua ngọt', N'https://example.com/suon-xao.jpg', @catXao, 480, 32.0),
(N'Bò lúc lắc', N'bo-luc-lac', N'Bò lúc lắc khoai tây', N'https://example.com/bo-luc-lac.jpg', @catXao, 520, 38.0),
(N'Canh bí đao', N'canh-bi-dao', N'Canh bí đao nấu tôm', N'https://example.com/canh-bi.jpg', @catCanh, 150, 10.0),
(N'Rau củ xào', N'rau-cu-xao', N'Rau củ xào thập cẩm', N'https://example.com/rau-cu.jpg', @catXao, 120, 5.0),
(N'Cơm nắm', N'com-nam', N'Cơm nắm onigiri', N'https://example.com/com-nam.jpg', @catA, 280, 8.0),
(N'Miso soup', N'miso-soup', N'Súp miso Nhật', N'https://example.com/miso.jpg', @catSoup, 80, 6.0),
(N'Gỏi gà', N'goi-ga', N'Gỏi gà bắp cải', N'https://example.com/goi-ga.jpg', @catSalad, 250, 25.0),
(N'Nem nướng', N'nem-nuong', N'Nem nướng Nha Trang', N'https://example.com/nem-nuong.jpg', @catNuong, 380, 22.0),
(N'Bánh xèo', N'banh-xeo', N'Bánh xèo miền Tây', N'https://example.com/banh-xeo.jpg', @catViet, 420, 15.0),
(N'Hủ tiếu Nam Vang', N'hu-tieu-nam-vang', N'Hủ tiếu Nam Vang', N'https://example.com/hu-tieu.jpg', @catViet, 480, 25.0),
(N'Cá chiên giòn', N'ca-chien-gion', N'Cá chiên giòn nước mắm', N'https://example.com/ca-chien.jpg', @catChien, 450, 35.0),
(N'Tôm chiên xù', N'tom-chien-xu', N'Tôm chiên xù', N'https://example.com/tom-chien.jpg', @catChien, 380, 28.0),
(N'Chè đậu xanh', N'che-dau-xanh', N'Chè đậu xanh nước cốt dừa', N'https://example.com/che.jpg', @catTrangMieng, 280, 8.0),
(N'Bánh flan', N'banh-flan', N'Bánh flan caramel', N'https://example.com/flan.jpg', @catTrangMieng, 220, 6.0),
(N'Nước ép cam', N'nuoc-ep-cam', N'Nước ép cam tươi', N'https://example.com/nuoc-cam.jpg', @catDoUongH, 120, 2.0),
(N'Sinh tố bơ', N'sinh-to-bo', N'Sinh tố bơ sữa', N'https://example.com/sinh-to-bo.jpg', @catDoUongH, 320, 6.0);
GO

------------------------------------------------
-- 8. RECIPES (1 per dish) – created_by lấy user thật
------------------------------------------------
DECLARE @FirstUser INT = (SELECT MIN(user_id) FROM users);

INSERT INTO recipes (dish_id, title, slug, description, instructions, prep_time_min, cook_time_min, servings, created_by, status)
SELECT
    d.dish_id,
    N'Công thức ' + d.name,
    N'cong-thuc-' + d.slug,
    N'Mô tả chi tiết công thức cho món ' + d.name,
    N'1. Chuẩn bị nguyên liệu.' + CHAR(13) + CHAR(10) +
    N'2. Sơ chế và ướp.' + CHAR(13) + CHAR(10) +
    N'3. Nấu chín theo hướng dẫn.' + CHAR(13) + CHAR(10) +
    N'4. Trình bày và thưởng thức.',
    10 + (d.dish_id % 20),
    15 + (d.dish_id % 40),
    2 + (d.dish_id % 4),
    (SELECT TOP 1 user_id FROM users ORDER BY NEWID()),  -- random user thật
    CASE 
        WHEN d.dish_id % 10 = 0 THEN N'flagged'
        WHEN d.dish_id % 7 = 0 THEN N'draft'
        WHEN d.dish_id % 5 = 0 THEN N'inactive'
        ELSE N'verified'
    END
FROM dishes d;
GO

------------------------------------------------
-- 9. RECIPE_INGREDIENTS (3 per recipe)
------------------------------------------------
;WITH R AS (
    SELECT recipe_id, ROW_NUMBER() OVER (ORDER BY recipe_id) AS rn FROM recipes
),
I AS (
    SELECT ingredient_id, ROW_NUMBER() OVER (ORDER BY ingredient_id) AS rn FROM ingredients
)
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, notes)
SELECT r.recipe_id, i.ingredient_id, 100 + (r.rn % 200), N'g', N'Nguyên liệu chính'
FROM R r
INNER JOIN I i ON i.rn = ((r.rn * 2) % 50) + 1;

;WITH R AS (
    SELECT recipe_id, ROW_NUMBER() OVER (ORDER BY recipe_id) AS rn FROM recipes
),
I AS (
    SELECT ingredient_id, ROW_NUMBER() OVER (ORDER BY ingredient_id) AS rn FROM ingredients
)
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, notes)
SELECT r.recipe_id, i.ingredient_id, 50 + (r.rn % 100), N'g', NULL
FROM R r
INNER JOIN I i ON i.rn = ((r.rn * 3) % 50) + 1
WHERE NOT EXISTS (
    SELECT 1 FROM recipe_ingredients ri
    WHERE ri.recipe_id = r.recipe_id AND ri.ingredient_id = i.ingredient_id
);

;WITH R AS (
    SELECT recipe_id, ROW_NUMBER() OVER (ORDER BY recipe_id) AS rn FROM recipes
),
I AS (
    SELECT ingredient_id, ROW_NUMBER() OVER (ORDER BY ingredient_id) AS rn FROM ingredients
)
INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, notes)
SELECT r.recipe_id, i.ingredient_id, 1 + (r.rn % 5), N'tbsp', N'Gia vị'
FROM R r
INNER JOIN I i ON i.rn = ((r.rn * 5) % 50) + 1
WHERE NOT EXISTS (
    SELECT 1 FROM recipe_ingredients ri
    WHERE ri.recipe_id = r.recipe_id AND ri.ingredient_id = i.ingredient_id
);
GO

------------------------------------------------
-- 10. CONTENTS (50)
------------------------------------------------
;WITH U AS (
    SELECT user_id, ROW_NUMBER() OVER (ORDER BY user_id) AS rn FROM users
)
INSERT INTO contents (user_id, content_type, title, slug, body, media_url, thumbnail_url, duration_sec, status, view_count)
SELECT
    u.user_id,
    CASE WHEN u.rn % 2 = 0 THEN N'BLOG' ELSE N'VIDEO' END,
    CASE WHEN u.rn % 2 = 0 THEN N'Bài viết dinh dưỡng số ' + CAST(u.rn AS NVARCHAR(10))
         ELSE N'Video nấu ăn số ' + CAST(u.rn AS NVARCHAR(10)) END,
    CASE WHEN u.rn % 2 = 0 THEN N'bai-viet-dinh-duong-' + CAST(u.rn AS NVARCHAR(10))
         ELSE N'video-nau-an-' + CAST(u.rn AS NVARCHAR(10)) END,
    CASE WHEN u.rn % 2 = 0 THEN N'Nội dung bài viết chi tiết về dinh dưỡng số ' + CAST(u.rn AS NVARCHAR(10)) ELSE NULL END,
    CASE WHEN u.rn % 2 = 1 THEN N'https://example.com/videos/video-' + CAST(u.rn AS NVARCHAR(10)) + N'.mp4' ELSE NULL END,
    N'https://example.com/thumbs/thumb-' + CAST(u.rn AS NVARCHAR(10)) + N'.jpg',
    CASE WHEN u.rn % 2 = 1 THEN 180 + (u.rn % 300) ELSE NULL END,
    CASE 
        WHEN u.rn % 11 = 0 THEN N'flagged'
        WHEN u.rn % 9 = 0 THEN N'under_review'
        WHEN u.rn % 7 = 0 THEN N'draft'
        WHEN u.rn % 13 = 0 THEN N'rejected'
        ELSE N'published'
    END,
    (u.rn * 37) % 5000
FROM U u;
GO

------------------------------------------------
-- 11. COMMENTS (~80)
------------------------------------------------
;WITH C AS (
    SELECT content_id, ROW_NUMBER() OVER (ORDER BY content_id) AS rn FROM contents
),
U AS (
    SELECT user_id, ROW_NUMBER() OVER (ORDER BY user_id) AS rn FROM users
)
INSERT INTO comments (user_id, content_id, parent_id, body, status)
SELECT
    u.user_id,
    c.content_id,
    NULL,
    N'Bình luận mẫu số ' + CAST(c.rn AS NVARCHAR(10)) + N'. Rất hữu ích!',
    CASE WHEN c.rn % 15 = 0 THEN N'hidden' WHEN c.rn % 20 = 0 THEN N'rejected' ELSE N'published' END
FROM C c
INNER JOIN U u ON u.rn = ((c.rn - 1) % 50) + 1;

-- thêm ~30 reply
;WITH Parent AS (
    SELECT comment_id, ROW_NUMBER() OVER (ORDER BY comment_id) AS rn FROM comments WHERE parent_id IS NULL
),
U AS (
    SELECT user_id, ROW_NUMBER() OVER (ORDER BY user_id) AS rn FROM users
)
INSERT INTO comments (user_id, content_id, parent_id, body, status)
SELECT
    u.user_id,
    (SELECT content_id FROM comments WHERE comment_id = p.comment_id),
    p.comment_id,
    N'Trả lời bình luận số ' + CAST(p.rn AS NVARCHAR(10)),
    N'published'
FROM Parent p
INNER JOIN U u ON u.rn = ((p.rn - 1) % 50) + 1
WHERE p.rn <= 30;
GO

------------------------------------------------
-- 12. VOTES (~100)
------------------------------------------------
;WITH C AS (
    SELECT content_id, ROW_NUMBER() OVER (ORDER BY content_id) AS rn FROM contents
),
U AS (
    SELECT user_id, ROW_NUMBER() OVER (ORDER BY user_id) AS rn FROM users
)
INSERT INTO votes (user_id, content_id, vote_value)
SELECT DISTINCT
    u.user_id,
    c.content_id,
    CASE WHEN (u.rn + c.rn) % 4 = 0 THEN -1 ELSE 1 END
FROM U u
CROSS JOIN C c
WHERE (u.rn + c.rn * 3) % 7 = 0;
GO

------------------------------------------------
-- 13. WEEKLY_MENUS (50)
------------------------------------------------
;WITH U AS (
    SELECT user_id, ROW_NUMBER() OVER (ORDER BY user_id) AS rn FROM users
)
INSERT INTO weekly_menus (user_id, title, start_date, end_date, target_calories, dietary_goal, status)
SELECT
    u.user_id,
    N'Thực đơn tuần ' + CAST(u.rn AS NVARCHAR(10)),
    DATEADD(WEEK, u.rn - 1, '2025-01-06'),
    DATEADD(DAY, 6, DATEADD(WEEK, u.rn - 1, '2025-01-06')),
    1800 + (u.rn % 800),
    CASE u.rn % 3 WHEN 0 THEN N'lose_weight' WHEN 1 THEN N'gain_muscle' ELSE N'maintain' END,
    CASE 
        WHEN u.rn % 8 = 0 THEN N'archived'
        WHEN u.rn % 5 = 0 THEN N'saved'
        WHEN u.rn % 3 = 0 THEN N'generated'
        ELSE N'initialized'
    END
FROM U u;
GO

------------------------------------------------
-- 14. WEEKLY_MENU_MEALS
------------------------------------------------
INSERT INTO weekly_menu_meals (menu_id, day_of_week, meal_type)
SELECT m.menu_id, d.day_of_week, t.meal_type
FROM weekly_menus m
CROSS JOIN (VALUES (1),(2),(3),(4),(5),(6),(7)) d(day_of_week)
CROSS JOIN (VALUES (N'breakfast'),(N'lunch'),(N'dinner')) t(meal_type);

-- snack cho ngày chẵn
INSERT INTO weekly_menu_meals (menu_id, day_of_week, meal_type)
SELECT m.menu_id, d.day_of_week, N'snack'
FROM weekly_menus m
CROSS JOIN (VALUES (2),(4),(6)) d(day_of_week);
GO

------------------------------------------------
-- 15. WEEKLY_MENU_ITEMS
------------------------------------------------
;WITH Meals AS (
    SELECT meal_id, ROW_NUMBER() OVER (ORDER BY meal_id) AS rn FROM weekly_menu_meals
),
DishList AS (
    SELECT dish_id, ROW_NUMBER() OVER (ORDER BY dish_id) AS rn FROM dishes
)
INSERT INTO weekly_menu_items (meal_id, dish_id, servings, notes)
SELECT m.meal_id, d.dish_id, 1.0, NULL
FROM Meals m
INNER JOIN DishList d ON d.rn = ((m.rn * 7) % 50) + 1;

;WITH Meals AS (
    SELECT meal_id, ROW_NUMBER() OVER (ORDER BY meal_id) AS rn FROM weekly_menu_meals
),
DishList AS (
    SELECT dish_id, ROW_NUMBER() OVER (ORDER BY dish_id) AS rn FROM dishes
)
INSERT INTO weekly_menu_items (meal_id, dish_id, servings, notes)
SELECT m.meal_id, d.dish_id, 0.5, N'Món phụ'
FROM Meals m
INNER JOIN DishList d ON d.rn = ((m.rn * 11) % 50) + 1
WHERE m.rn % 3 = 0
  AND NOT EXISTS (
      SELECT 1 FROM weekly_menu_items w
      WHERE w.meal_id = m.meal_id AND w.dish_id = d.dish_id
  );
GO

------------------------------------------------
-- 16. RESTAURANTS (50)
------------------------------------------------
INSERT INTO restaurants (name, address, city, district, latitude, longitude, phone, website, description) VALUES
(N'Phở 24', N'123 Nguyễn Huệ', N'Hồ Chí Minh', N'Quận 1', 10.7769000, 106.7009000, N'0281234567', N'https://pho24.vn', N'Chuỗi phở nổi tiếng'),
(N'Cơm Tấm Cali', N'45 Lê Lợi', N'Hồ Chí Minh', N'Quận 1', 10.7730000, 106.7015000, N'0282345678', NULL, N'Cơm tấm ngon'),
(N'Bún Chả Hà Thành', N'78 Hoàn Kiếm', N'Hà Nội', N'Hoàn Kiếm', 21.0285000, 105.8542000, N'0243456789', NULL, N'Bún chả truyền thống'),
(N'Lẩu Đức Trọc', N'12 Nguyễn Trãi', N'Hồ Chí Minh', N'Quận 5', 10.7560000, 106.6670000, N'0284567890', NULL, N'Lẩu bò ngon'),
(N'Pizza 4P''s', N'8 Nguyễn Thiệp', N'Hồ Chí Minh', N'Quận 1', 10.7755000, 106.7030000, N'0285678901', N'https://pizza4ps.com', N'Pizza kiểu Nhật'),
(N'Sushi Hokkaido', N'56 Điện Biên Phủ', N'Hồ Chí Minh', N'Quận 3', 10.7820000, 106.6900000, N'0286789012', NULL, N'Sushi tươi'),
(N'Gà Nướng Ò Ó O', N'90 Cách Mạng Tháng 8', N'Hồ Chí Minh', N'Quận 3', 10.7780000, 106.6800000, N'0287890123', NULL, N'Gà nướng than hoa'),
(N'Bánh Mì Huỳnh Hoa', N'26 Lê Thị Riêng', N'Hồ Chí Minh', N'Quận 1', 10.7710000, 106.6905000, N'0288901234', NULL, N'Bánh mì nổi tiếng'),
(N'Chả Cá Lã Vọng', N'14 Chả Cá', N'Hà Nội', N'Hoàn Kiếm', 21.0340000, 105.8480000, N'0249012345', NULL, N'Chả cá truyền thống'),
(N'Cơm Gà Hội An', N'33 Nguyễn Thị Minh Khai', N'Hồ Chí Minh', N'Quận 1', 10.7800000, 106.6950000, N'0280123456', NULL, N'Cơm gà Hội An'),
(N'Quán Ăn Ngon', N'15 Lý Tự Trọng', N'Hồ Chí Minh', N'Quận 1', 10.7770000, 106.7020000, N'0281234500', NULL, N'Món Việt đa dạng'),
(N'Healthy Green', N'22 Pasteur', N'Hồ Chí Minh', N'Quận 1', 10.7785000, 106.6980000, N'0282345600', N'https://healthygreen.vn', N'Món salad & healthy'),
(N'Vườn Bia', N'100 Võ Văn Tần', N'Hồ Chí Minh', N'Quận 3', 10.7750000, 106.6850000, N'0283456700', NULL, N'Nhậu & món Việt'),
(N'Cá Hồi Na Uy', N'45 Hai Bà Trưng', N'Hồ Chí Minh', N'Quận 1', 10.7825000, 106.7000000, N'0284567800', NULL, N'Cá hồi tươi'),
(N'Nem Nướng Nha Trang', N'67 Nguyễn Đình Chiểu', N'Hồ Chí Minh', N'Quận 3', 10.7790000, 106.6880000, N'0285678900', NULL, N'Nem nướng chuẩn'),
(N'Bún Bò Huế 86', N'86 Nguyễn Chí Thanh', N'Hà Nội', N'Đống Đa', 21.0200000, 105.8100000, N'0246789000', NULL, N'Bún bò Huế cay'),
(N'Phở Thìn', N'13 Lò Đúc', N'Hà Nội', N'Hai Bà Trưng', 21.0150000, 105.8600000, N'0247890100', NULL, N'Phở bò nổi tiếng'),
(N'Cơm Niêu Singapore', N'28 Lê Thánh Tôn', N'Hồ Chí Minh', N'Quận 1', 10.7760000, 106.7050000, N'0288901200', NULL, N'Cơm niêu'),
(N'Salad Bar Organic', N'5 Nguyễn Huệ', N'Hồ Chí Minh', N'Quận 1', 10.7740000, 106.7010000, N'0289012300', NULL, N'Salad organic'),
(N'Lẩu Thái Tom Yum', N'120 Nguyễn Trãi', N'Hồ Chí Minh', N'Quận 5', 10.7550000, 106.6650000, N'0280123400', NULL, N'Lẩu Thái'),
(N'Quán Chay An Lạc', N'34 Sư Vạn Hạnh', N'Hồ Chí Minh', N'Quận 10', 10.7700000, 106.6700000, N'0281234600', NULL, N'Món chay'),
(N'Bánh Xèo Miền Tây', N'56 Trần Hưng Đạo', N'Hồ Chí Minh', N'Quận 1', 10.7680000, 106.6950000, N'0282345700', NULL, N'Bánh xèo'),
(N'Hủ Tiếu Mỹ Tho', N'78 Nguyễn Thái Bình', N'Hồ Chí Minh', N'Quận 1', 10.7690000, 106.7000000, N'0283456800', NULL, N'Hủ tiếu'),
(N'Cơm Gà xối mỡ', N'90 Lê Văn Sỹ', N'Hồ Chí Minh', N'Quận 3', 10.7900000, 106.6800000, N'0284567900', NULL, N'Cơm gà xối mỡ'),
(N'Steak House', N'12 Pasteur', N'Hồ Chí Minh', N'Quận 1', 10.7775000, 106.6970000, N'0285678000', NULL, N'Steak bò Mỹ'),
(N'Yoshinoya', N'1 Nguyễn Huệ', N'Hồ Chí Minh', N'Quận 1', 10.7750000, 106.7015000, N'0286789100', N'https://yoshinoya.vn', N'Cơm bò Nhật'),
(N'KFC', N'50 Lê Lợi', N'Hồ Chí Minh', N'Quận 1', 10.7735000, 106.7020000, N'0287890200', N'https://kfcvietnam.com.vn', N'Gà rán'),
(N'Lotteria', N'25 Nguyễn Thị Minh Khai', N'Hồ Chí Minh', N'Quận 1', 10.7810000, 106.6940000, N'0288901300', NULL, N'Fast food'),
(N'Highlands Coffee', N'100 Nguyễn Huệ', N'Hồ Chí Minh', N'Quận 1', 10.7765000, 106.7005000, N'0289012400', N'https://highlands.vn', N'Cà phê & bánh'),
(N'The Pizza Company', N'8 Lê Duẩn', N'Hồ Chí Minh', N'Quận 1', 10.7805000, 106.7000000, N'0280123500', NULL, N'Pizza'),
(N'Gogi House', N'45 Võ Văn Tần', N'Hồ Chí Minh', N'Quận 3', 10.7760000, 106.6855000, N'0281234700', NULL, N'BBQ Hàn Quốc'),
(N'Kichi Kichi', N'67 Nguyễn Đình Chiểu', N'Hồ Chí Minh', N'Quận 3', 10.7785000, 106.6890000, N'0282345800', NULL, N'Lẩu băng chuyền'),
(N'Hutong', N'22 Hai Bà Trưng', N'Hồ Chí Minh', N'Quận 1', 10.7830000, 106.6985000, N'0283456900', NULL, N'Lẩu Hong Kong'),
(N'Dimsum Chi', N'15 Lê Thánh Tôn', N'Hồ Chí Minh', N'Quận 1', 10.7768000, 106.7040000, N'0284568000', NULL, N'Dimsum'),
(N'Quán Ốc Đào', N'30 Nguyễn Thượng Hiền', N'Hồ Chí Minh', N'Quận 3', 10.7850000, 106.6800000, N'0285678100', NULL, N'Ốc & hải sản'),
(N'Bún Đậu Mắm Tôm', N'55 Cách Mạng Tháng 8', N'Hồ Chí Minh', N'Quận 3', 10.7770000, 106.6820000, N'0286789200', NULL, N'Bún đậu'),
(N'Cháo Lòng', N'12 Nguyễn Văn Cừ', N'Hồ Chí Minh', N'Quận 5', 10.7600000, 106.6750000, N'0287890300', NULL, N'Cháo lòng'),
(N'Phở Hòa', N'260 Pasteur', N'Hồ Chí Minh', N'Quận 3', 10.7800000, 106.6900000, N'0288901400', NULL, N'Phở bò'),
(N'Cơm Gà 9', N'9 Nguyễn Thị Diệu', N'Hồ Chí Minh', N'Quận 3', 10.7820000, 106.6880000, N'0289012500', NULL, N'Cơm gà'),
(N'Bánh Cuốn Thanh Vân', N'14 Hàng Gà', N'Hà Nội', N'Hoàn Kiếm', 21.0320000, 105.8500000, N'0240123600', NULL, N'Bánh cuốn'),
(N'Chả Cá Anh Vũ', N'21 Đường Thành', N'Hà Nội', N'Hoàn Kiếm', 21.0330000, 105.8470000, N'0241234800', NULL, N'Chả cá'),
(N'Bún Chả Hương Liên', N'24 Lê Văn Hưu', N'Hà Nội', N'Hai Bà Trưng', 21.0180000, 105.8550000, N'0242345900', NULL, N'Bún chả Obama'),
(N'Phở Gia Truyền', N'49 Bát Đàn', N'Hà Nội', N'Hoàn Kiếm', 21.0350000, 105.8460000, N'0243457000', NULL, N'Phở gia truyền'),
(N'Cơm Tấm Sài Gòn', N'100 Nguyễn Trãi', N'Hà Nội', N'Thanh Xuân', 20.9950000, 105.8050000, N'0244568100', NULL, N'Cơm tấm'),
(N'Lẩu Dê 404', N'404 Giải Phóng', N'Hà Nội', N'Hai Bà Trưng', 21.0000000, 105.8400000, N'0245678200', NULL, N'Lẩu dê'),
(N'Nem Rán Cô Ba', N'5 Hàng Bông', N'Hà Nội', N'Hoàn Kiếm', 21.0300000, 105.8485000, N'0246789300', NULL, N'Nem rán'),
(N'Gỏi Cuốn Sài Gòn', N'18 Nguyễn Du', N'Hà Nội', N'Hai Bà Trưng', 21.0160000, 105.8500000, N'0247890400', NULL, N'Gỏi cuốn'),
(N'Smoothie Factory', N'7 Nguyễn Huệ', N'Hồ Chí Minh', N'Quận 1', 10.7752000, 106.7012000, N'0288901500', NULL, N'Smoothie & nước ép'),
(N'Organic Farm Cafe', N'33 Pasteur', N'Hồ Chí Minh', N'Quận 1', 10.7782000, 106.6975000, N'0289012600', NULL, N'Cafe organic'),
(N'Vegan Corner', N'19 Lê Lợi', N'Hồ Chí Minh', N'Quận 1', 10.7738000, 106.7018000, N'0280123700', NULL, N'Món chay vegan');
GO

------------------------------------------------
-- 17. RESTAURANT_DISHES
------------------------------------------------
;WITH R AS (
    SELECT restaurant_id, ROW_NUMBER() OVER (ORDER BY restaurant_id) AS rn FROM restaurants
),
D AS (
    SELECT dish_id, ROW_NUMBER() OVER (ORDER BY dish_id) AS rn FROM dishes
)
INSERT INTO restaurant_dishes (restaurant_id, dish_id)
SELECT r.restaurant_id, d.dish_id
FROM R r
INNER JOIN D d ON d.rn IN (
    ((r.rn * 2) % 50) + 1,
    ((r.rn * 3) % 50) + 1,
    CASE WHEN r.rn % 2 = 0 THEN ((r.rn * 5) % 50) + 1 END,
    CASE WHEN r.rn % 3 = 0 THEN ((r.rn * 7) % 50) + 1 END
)
WHERE d.rn IS NOT NULL;
GO

------------------------------------------------
-- 18. CHAT_SESSIONS (50)
------------------------------------------------
;WITH U AS (
    SELECT user_id, ROW_NUMBER() OVER (ORDER BY user_id) AS rn FROM users
)
INSERT INTO chat_sessions (user_id, title, is_trial, status, trial_query_count)
SELECT
    CASE WHEN u.rn <= 10 THEN NULL ELSE u.user_id END,
    N'Phiên chat dinh dưỡng #' + CAST(u.rn AS NVARCHAR(10)),
    CASE WHEN u.rn <= 10 THEN 1 ELSE 0 END,
    CASE 
        WHEN u.rn <= 5 THEN N'trial_active'
        WHEN u.rn <= 10 THEN N'trial_depleted'
        WHEN u.rn % 7 = 0 THEN N'closed'
        ELSE N'member_active'
    END,
    CASE WHEN u.rn <= 10 THEN (u.rn % 4) ELSE 0 END
FROM U u;
GO

------------------------------------------------
-- 19. CHAT_MESSAGES
------------------------------------------------
INSERT INTO chat_messages (session_id, sender_type, content)
SELECT s.session_id, N'USER', N'Xin chào, tôi muốn hỏi về chế độ ăn.'
FROM chat_sessions s;

INSERT INTO chat_messages (session_id, sender_type, content)
SELECT s.session_id, N'ASSISTANT', N'Chào bạn! Dựa trên thông tin của bạn, tôi gợi ý thực đơn cân bằng dinh dưỡng...'
FROM chat_sessions s;

INSERT INTO chat_messages (session_id, sender_type, content)
SELECT s.session_id, N'USER', N'Cảm ơn, cho tôi thêm gợi ý món ăn nhé.'
FROM chat_sessions s
WHERE s.session_id % 2 = 0;

INSERT INTO chat_messages (session_id, sender_type, content)
SELECT s.session_id, N'ASSISTANT', N'Dưới đây là một số món phù hợp: Phở bò, Salad gà, Cá hồi nướng...'
FROM chat_sessions s
WHERE s.session_id % 2 = 0;

INSERT INTO chat_messages (session_id, sender_type, content)
SELECT s.session_id, N'SYSTEM', N'Phiên chat đã kết thúc hoặc đạt giới hạn.'
FROM chat_sessions s
WHERE s.session_id % 5 = 0;
GO

------------------------------------------------
-- 20. CONTENT_MODERATIONS
------------------------------------------------
INSERT INTO content_moderations (content_id, ai_flagged, ai_reason, ai_confidence, status, reviewed_by, reviewed_at, admin_note)
SELECT 
    c.content_id,
    1,
    N'Nội dung có thể chứa thông tin dinh dưỡng chưa được kiểm chứng',
    CAST(0.75 + (c.content_id % 20) * 0.01 AS DECIMAL(5,4)),
    CASE 
        WHEN c.content_id % 3 = 0 THEN N'approved'
        WHEN c.content_id % 3 = 1 THEN N'rejected'
        ELSE N'pending'
    END,
    CASE WHEN c.content_id % 3 <> 2 THEN (SELECT TOP 1 user_id FROM users ORDER BY user_id) ELSE NULL END,
    CASE WHEN c.content_id % 3 <> 2 THEN DATEADD(HOUR, c.content_id % 100, SYSUTCDATETIME()) ELSE NULL END,
    CASE WHEN c.content_id % 3 = 1 THEN N'Nội dung vi phạm quy định' ELSE NULL END
FROM contents c
WHERE c.status IN (N'flagged', N'under_review', N'rejected')
   OR c.content_id % 7 = 0;
GO

------------------------------------------------
-- Summary
------------------------------------------------
DECLARE @c1 INT, @c2 INT, @c3 INT, @c4 INT, @c5 INT, @c6 INT, @c7 INT, @c8 INT, @c9 INT;
DECLARE @c10 INT, @c11 INT, @c12 INT, @c13 INT, @c14 INT, @c15 INT, @c16 INT, @c17 INT, @c18 INT, @c19 INT, @c20 INT;

SELECT @c1 = COUNT(*) FROM roles;
SELECT @c2 = COUNT(*) FROM users;
SELECT @c3 = COUNT(*) FROM user_profiles;
SELECT @c4 = COUNT(*) FROM categories;
SELECT @c5 = COUNT(*) FROM ingredients;
SELECT @c6 = COUNT(*) FROM user_allergies;
SELECT @c7 = COUNT(*) FROM dishes;
SELECT @c8 = COUNT(*) FROM recipes;
SELECT @c9 = COUNT(*) FROM recipe_ingredients;
SELECT @c10 = COUNT(*) FROM contents;
SELECT @c11 = COUNT(*) FROM comments;
SELECT @c12 = COUNT(*) FROM votes;
SELECT @c13 = COUNT(*) FROM weekly_menus;
SELECT @c14 = COUNT(*) FROM weekly_menu_meals;
SELECT @c15 = COUNT(*) FROM weekly_menu_items;
SELECT @c16 = COUNT(*) FROM restaurants;
SELECT @c17 = COUNT(*) FROM restaurant_dishes;
SELECT @c18 = COUNT(*) FROM chat_sessions;
SELECT @c19 = COUNT(*) FROM chat_messages;
SELECT @c20 = COUNT(*) FROM content_moderations;

PRINT N'===== SAMPLE DATA OK =====';
PRINT N'roles              : ' + CAST(@c1 AS NVARCHAR(10));
PRINT N'users              : ' + CAST(@c2 AS NVARCHAR(10));
PRINT N'user_profiles      : ' + CAST(@c3 AS NVARCHAR(10));
PRINT N'categories         : ' + CAST(@c4 AS NVARCHAR(10));
PRINT N'ingredients        : ' + CAST(@c5 AS NVARCHAR(10));
PRINT N'user_allergies     : ' + CAST(@c6 AS NVARCHAR(10));
PRINT N'dishes             : ' + CAST(@c7 AS NVARCHAR(10));
PRINT N'recipes            : ' + CAST(@c8 AS NVARCHAR(10));
PRINT N'recipe_ingredients : ' + CAST(@c9 AS NVARCHAR(10));
PRINT N'contents           : ' + CAST(@c10 AS NVARCHAR(10));
PRINT N'comments           : ' + CAST(@c11 AS NVARCHAR(10));
PRINT N'votes              : ' + CAST(@c12 AS NVARCHAR(10));
PRINT N'weekly_menus       : ' + CAST(@c13 AS NVARCHAR(10));
PRINT N'weekly_menu_meals  : ' + CAST(@c14 AS NVARCHAR(10));
PRINT N'weekly_menu_items  : ' + CAST(@c15 AS NVARCHAR(10));
PRINT N'restaurants        : ' + CAST(@c16 AS NVARCHAR(10));
PRINT N'restaurant_dishes  : ' + CAST(@c17 AS NVARCHAR(10));
PRINT N'chat_sessions      : ' + CAST(@c18 AS NVARCHAR(10));
PRINT N'chat_messages      : ' + CAST(@c19 AS NVARCHAR(10));
PRINT N'content_moderations: ' + CAST(@c20 AS NVARCHAR(10));
GO
