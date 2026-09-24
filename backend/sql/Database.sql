-- =============================================
-- Database: NutriBot
-- Microsoft SQL Server (T-SQL) - FINAL
-- Kiến trúc nghiệp vụ:
--   INGREDIENT = Nguyên liệu
--   DISH       = Món ăn (entity trung tâm)
--   RECIPE     = Công thức
-- Weekly Menu & Restaurant → DISH
-- =============================================

IF DB_ID(N'NutriBotV2') IS NOT NULL
BEGIN
    ALTER DATABASE NutriBotV2 SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE NutriBotV2;
END
GO

CREATE DATABASE NutriBotV2;
GO

USE NutriBotV2;
GO

------------------------------------------------
-- 1. ROLES & USERS
------------------------------------------------
CREATE TABLE roles (
    role_id         INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    role_name       NVARCHAR(50) NOT NULL,
    description     NVARCHAR(255) NULL,
    CONSTRAINT UQ_roles_role_name UNIQUE (role_name)
);
GO

CREATE TABLE users (
    user_id         INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    username        NVARCHAR(50) NOT NULL,
    email           NVARCHAR(255) NOT NULL,
    password_hash   NVARCHAR(255) NOT NULL,
    full_name       NVARCHAR(150) NULL,
    avatar_url      NVARCHAR(500) NULL,
    bio             NVARCHAR(500) NULL,
    role_id         INT NOT NULL,
    strike_count    TINYINT NOT NULL CONSTRAINT DF_users_strike_count DEFAULT (0),
    status          NVARCHAR(20) NOT NULL CONSTRAINT DF_users_status DEFAULT (N'ACTIVE'),
    created_at      DATETIME2(3) NOT NULL CONSTRAINT DF_users_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at      DATETIME2(3) NOT NULL CONSTRAINT DF_users_updated_at DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT UQ_users_username UNIQUE (username),
    CONSTRAINT UQ_users_email UNIQUE (email),
    CONSTRAINT FK_users_roles FOREIGN KEY (role_id) REFERENCES roles(role_id),
    CONSTRAINT CK_users_strike_count CHECK (strike_count >= 0),
    CONSTRAINT CK_users_status CHECK (status IN (N'ACTIVE', N'WARN', N'SUSPENDED', N'BANNED'))
);
GO

-- Trigger tự động cập nhật status theo strike_count
CREATE TRIGGER TR_users_auto_update_status_by_strike
ON users
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;

    UPDATE u
    SET status = CASE
                    WHEN i.status = N'BANNED' THEN N'BANNED'
                    WHEN i.strike_count >= 3 THEN N'SUSPENDED'
                    WHEN i.strike_count BETWEEN 1 AND 2 THEN N'WARN'
                    ELSE N'ACTIVE'
                 END,
        updated_at = SYSUTCDATETIME()
    FROM users u
    INNER JOIN inserted i ON u.user_id = i.user_id;
END;
GO

CREATE TABLE user_profiles (
    user_id         INT NOT NULL PRIMARY KEY,
    height_cm       DECIMAL(5,2) NULL,
    weight_kg       DECIMAL(5,2) NULL,
    gender          NVARCHAR(20) NULL,
    date_of_birth   DATE NULL,
    health_goal     NVARCHAR(50) NULL,
    updated_at      DATETIME2(3) NOT NULL CONSTRAINT DF_user_profiles_updated_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_user_profiles_users FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT CK_user_profiles_height CHECK (height_cm IS NULL OR (height_cm > 0 AND height_cm < 300)),
    CONSTRAINT CK_user_profiles_weight CHECK (weight_kg IS NULL OR (weight_kg > 0 AND weight_kg < 500)),
    CONSTRAINT CK_user_profiles_health_goal CHECK (health_goal IS NULL OR health_goal IN (N'lose_weight', N'gain_muscle', N'maintain'))
);
GO

------------------------------------------------
-- 2. CATEGORIES
------------------------------------------------
CREATE TABLE categories (
    category_id     INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    name            NVARCHAR(100) NOT NULL,
    slug            NVARCHAR(120) NOT NULL,
    description     NVARCHAR(500) NULL,
    category_type   NVARCHAR(20) NOT NULL,               -- INGREDIENT | RECIPE
    is_active       BIT NOT NULL CONSTRAINT DF_categories_is_active DEFAULT (1),
    created_at      DATETIME2(3) NOT NULL CONSTRAINT DF_categories_created_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_categories_name UNIQUE (name),
    CONSTRAINT UQ_categories_slug UNIQUE (slug),
    CONSTRAINT CK_categories_category_type CHECK (category_type IN (N'INGREDIENT', N'RECIPE'))
);
GO

------------------------------------------------
-- 3. INGREDIENTS (Nguyên liệu) + ALLERGIES
------------------------------------------------
CREATE TABLE ingredients (
    ingredient_id   INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    name            NVARCHAR(150) NOT NULL,
    slug            NVARCHAR(180) NOT NULL,
    description     NVARCHAR(500) NULL,
    category_id     INT NOT NULL,                        -- phải là category_type = INGREDIENT
    is_active       BIT NOT NULL CONSTRAINT DF_ingredients_is_active DEFAULT (1),
    created_at      DATETIME2(3) NOT NULL CONSTRAINT DF_ingredients_created_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_ingredients_name UNIQUE (name),
    CONSTRAINT UQ_ingredients_slug UNIQUE (slug),
    CONSTRAINT FK_ingredients_categories FOREIGN KEY (category_id) REFERENCES categories(category_id)
);
GO

CREATE TABLE user_allergies (
    user_id       INT NOT NULL,
    ingredient_id INT NOT NULL,

    CONSTRAINT PK_user_allergies
        PRIMARY KEY (user_id, ingredient_id),

    CONSTRAINT FK_user_allergies_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE,

    CONSTRAINT FK_user_allergies_ingredient
        FOREIGN KEY (ingredient_id)
        REFERENCES ingredients(ingredient_id)
        ON DELETE CASCADE
);

------------------------------------------------
-- 4. DISHES (Món ăn - Entity trung tâm)
------------------------------------------------
CREATE TABLE dishes (
    dish_id         INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    name            NVARCHAR(150) NOT NULL,
    slug            NVARCHAR(180) NOT NULL,
    description     NVARCHAR(MAX) NULL,
    image_url       NVARCHAR(500) NULL,
    category_id     INT NOT NULL,                        -- phải là category_type = RECIPE
    calories        INT NULL,
    protein_g       DECIMAL(6,2) NULL,
    is_active       BIT NOT NULL CONSTRAINT DF_dishes_is_active DEFAULT (1),
    created_at      DATETIME2(3) NOT NULL CONSTRAINT DF_dishes_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at      DATETIME2(3) NOT NULL CONSTRAINT DF_dishes_updated_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_dishes_name UNIQUE (name),
    CONSTRAINT UQ_dishes_slug UNIQUE (slug),
    CONSTRAINT FK_dishes_categories FOREIGN KEY (category_id) REFERENCES categories(category_id),
    CONSTRAINT CK_dishes_calories CHECK (calories IS NULL OR calories >= 0),
    CONSTRAINT CK_dishes_protein CHECK (protein_g IS NULL OR protein_g >= 0)
);
GO

------------------------------------------------
-- 5. RECIPES (Công thức của Dish)
------------------------------------------------
CREATE TABLE recipes (
    recipe_id       INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    dish_id         INT NOT NULL,
    title           NVARCHAR(255) NOT NULL,
    slug            NVARCHAR(280) NOT NULL,
    description     NVARCHAR(MAX) NULL,
    instructions    NVARCHAR(MAX) NULL,
    prep_time_min   INT NULL,
    cook_time_min   INT NULL,
    servings        INT NULL,
    created_by      INT NULL,
    status          NVARCHAR(20) NOT NULL CONSTRAINT DF_recipes_status DEFAULT (N'draft'),
    created_at      DATETIME2(3) NOT NULL CONSTRAINT DF_recipes_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at      DATETIME2(3) NOT NULL CONSTRAINT DF_recipes_updated_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_recipes_slug UNIQUE (slug),
    CONSTRAINT FK_recipes_dishes FOREIGN KEY (dish_id) REFERENCES dishes(dish_id),
    CONSTRAINT FK_recipes_users FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT CK_recipes_status CHECK (status IN (N'draft', N'verified', N'flagged', N'inactive')),
    CONSTRAINT CK_recipes_prep CHECK (prep_time_min IS NULL OR prep_time_min >= 0),
    CONSTRAINT CK_recipes_cook CHECK (cook_time_min IS NULL OR cook_time_min >= 0),
    CONSTRAINT CK_recipes_servings CHECK (servings IS NULL OR servings > 0)
);
GO

------------------------------------------------
-- 6. RECIPE_INGREDIENTS
------------------------------------------------
CREATE TABLE recipe_ingredients (
    recipe_id       INT NOT NULL,
    ingredient_id   INT NOT NULL,
    quantity        DECIMAL(10,2) NOT NULL,
    unit            NVARCHAR(30) NOT NULL,
    notes           NVARCHAR(200) NULL,
    PRIMARY KEY (recipe_id, ingredient_id),
    CONSTRAINT FK_recipe_ingredients_recipes FOREIGN KEY (recipe_id) REFERENCES recipes(recipe_id) ON DELETE CASCADE,
    CONSTRAINT FK_recipe_ingredients_ingredients FOREIGN KEY (ingredient_id) REFERENCES ingredients(ingredient_id),
    CONSTRAINT CK_recipe_ingredients_quantity CHECK (quantity > 0)
);
GO

------------------------------------------------
-- 7. CONTENTS (Blog + Video gộp chung)
------------------------------------------------
CREATE TABLE contents (
    content_id      INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    user_id         INT NOT NULL,
    content_type    NVARCHAR(10) NOT NULL,               -- BLOG | VIDEO
    title           NVARCHAR(255) NOT NULL,
    slug            NVARCHAR(280) NOT NULL,
    body            NVARCHAR(MAX) NULL,                 -- BLOG
    media_url       NVARCHAR(500) NULL,                 -- VIDEO
    thumbnail_url   NVARCHAR(500) NULL,
    duration_sec    INT NULL,                           -- VIDEO
    status          NVARCHAR(20) NOT NULL CONSTRAINT DF_contents_status DEFAULT (N'draft'),
    view_count      INT NOT NULL CONSTRAINT DF_contents_view_count DEFAULT (0),
    created_at      DATETIME2(3) NOT NULL CONSTRAINT DF_contents_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at      DATETIME2(3) NOT NULL CONSTRAINT DF_contents_updated_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_contents_slug UNIQUE (slug),
    CONSTRAINT FK_contents_users FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE NO ACTION,
    CONSTRAINT CK_contents_type CHECK (content_type IN (N'BLOG', N'VIDEO')),
    CONSTRAINT CK_contents_status CHECK (status IN (N'draft', N'under_review', N'published', N'flagged', N'rejected', N'archived')),
    CONSTRAINT CK_contents_view_count CHECK (view_count >= 0),
    CONSTRAINT CK_contents_duration CHECK (duration_sec IS NULL OR duration_sec >= 0)
);
GO

------------------------------------------------
-- 8. COMMENTS & VOTES
------------------------------------------------
CREATE TABLE comments (
    comment_id      INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    user_id         INT NULL,
    content_id      INT NOT NULL,
    parent_id       INT NULL,
    body            NVARCHAR(MAX) NOT NULL,
    status          NVARCHAR(20) NOT NULL CONSTRAINT DF_comments_status DEFAULT (N'published'),
    created_at      DATETIME2(3) NOT NULL CONSTRAINT DF_comments_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at      DATETIME2(3) NOT NULL CONSTRAINT DF_comments_updated_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_comments_users FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT FK_comments_contents FOREIGN KEY (content_id) REFERENCES contents(content_id) ON DELETE CASCADE,
    CONSTRAINT FK_comments_parent FOREIGN KEY (parent_id) REFERENCES comments(comment_id) ON DELETE NO ACTION,
    CONSTRAINT CK_comments_status CHECK (status IN (N'published', N'hidden', N'rejected'))
);
GO

CREATE TABLE votes (
    vote_id         INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    user_id         INT NOT NULL,
    content_id      INT NOT NULL,
    vote_value      SMALLINT NOT NULL,
    created_at      DATETIME2(3) NOT NULL CONSTRAINT DF_votes_created_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_votes_user_content UNIQUE (user_id, content_id),
    CONSTRAINT FK_votes_users FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT FK_votes_contents FOREIGN KEY (content_id) REFERENCES contents(content_id) ON DELETE CASCADE,
    CONSTRAINT CK_votes_value CHECK (vote_value IN (-1, 1))
);
GO

------------------------------------------------
-- 9. WEEKLY MENU (liên kết với DISH)
------------------------------------------------
CREATE TABLE weekly_menus (
    menu_id         INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    user_id         INT NOT NULL,
    title           NVARCHAR(150) NULL,
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    target_calories INT NULL,
    dietary_goal    NVARCHAR(100) NULL,
    status          NVARCHAR(20) NOT NULL CONSTRAINT DF_weekly_menus_status DEFAULT (N'initialized'),
    created_at      DATETIME2(3) NOT NULL CONSTRAINT DF_weekly_menus_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at      DATETIME2(3) NOT NULL CONSTRAINT DF_weekly_menus_updated_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_weekly_menus_users FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT CK_weekly_menus_status CHECK (status IN (N'initialized', N'generated', N'saved', N'archived')),
    CONSTRAINT CK_weekly_menus_dates CHECK (
        end_date >= start_date
        AND DATEDIFF(DAY, start_date, end_date) = 6
    )
);
GO

CREATE TABLE weekly_menu_meals (
    meal_id         INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    menu_id         INT NOT NULL,
    day_of_week     TINYINT NOT NULL,               -- 1=Mon ... 7=Sun
    meal_type       NVARCHAR(20) NOT NULL,
    CONSTRAINT FK_weekly_menu_meals_menus FOREIGN KEY (menu_id) REFERENCES weekly_menus(menu_id) ON DELETE CASCADE,
    CONSTRAINT CK_weekly_menu_meals_day CHECK (day_of_week BETWEEN 1 AND 7),
    CONSTRAINT CK_weekly_menu_meals_type CHECK (meal_type IN (N'breakfast', N'lunch', N'dinner', N'snack')),
    CONSTRAINT UQ_weekly_menu_meals UNIQUE (menu_id, day_of_week, meal_type)
);
GO

CREATE TABLE weekly_menu_items (
    item_id         INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    meal_id         INT NOT NULL,
    dish_id         INT NOT NULL,                    -- liên kết với DISH
    servings        DECIMAL(4,2) NULL CONSTRAINT DF_weekly_menu_items_servings DEFAULT (1),
    notes           NVARCHAR(300) NULL,
    CONSTRAINT FK_weekly_menu_items_meals FOREIGN KEY (meal_id) REFERENCES weekly_menu_meals(meal_id) ON DELETE CASCADE,
    CONSTRAINT FK_weekly_menu_items_dishes FOREIGN KEY (dish_id) REFERENCES dishes(dish_id),
    CONSTRAINT UQ_weekly_menu_items_meal_dish UNIQUE (meal_id, dish_id)
);
GO

------------------------------------------------
-- 10. RESTAURANTS (liên kết với DISH)
------------------------------------------------
CREATE TABLE restaurants (
    restaurant_id   INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    name            NVARCHAR(200) NOT NULL,
    address         NVARCHAR(500) NOT NULL,
    city            NVARCHAR(100) NULL,
    district        NVARCHAR(100) NULL,
    latitude        DECIMAL(10,7) NULL,
    longitude       DECIMAL(10,7) NULL,
    phone           NVARCHAR(30) NULL,
    website         NVARCHAR(255) NULL,
    description     NVARCHAR(MAX) NULL,
    is_active       BIT NOT NULL CONSTRAINT DF_restaurants_is_active DEFAULT (1),
    created_at      DATETIME2(3) NOT NULL CONSTRAINT DF_restaurants_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at      DATETIME2(3) NOT NULL CONSTRAINT DF_restaurants_updated_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT CK_restaurants_lat CHECK (latitude IS NULL OR (latitude BETWEEN -90 AND 90)),
    CONSTRAINT CK_restaurants_lng CHECK (longitude IS NULL OR (longitude BETWEEN -180 AND 180))
);
GO

CREATE TABLE restaurant_dishes (
    restaurant_id   INT NOT NULL,
    dish_id         INT NOT NULL,
    PRIMARY KEY (restaurant_id, dish_id),
    CONSTRAINT FK_restaurant_dishes_restaurants FOREIGN KEY (restaurant_id) REFERENCES restaurants(restaurant_id) ON DELETE CASCADE,
    CONSTRAINT FK_restaurant_dishes_dishes FOREIGN KEY (dish_id) REFERENCES dishes(dish_id) ON DELETE CASCADE
);
GO

------------------------------------------------
-- 11. AI NUTRITION CHATBOT
------------------------------------------------
CREATE TABLE chat_sessions (
    session_id      INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    user_id         INT NULL,
    title           NVARCHAR(200) NULL,
    is_trial        BIT NOT NULL CONSTRAINT DF_chat_sessions_is_trial DEFAULT (0),
    status          NVARCHAR(20) NOT NULL CONSTRAINT DF_chat_sessions_status DEFAULT (N'trial_active'),
    trial_query_count TINYINT NOT NULL CONSTRAINT DF_chat_sessions_trial_query_count DEFAULT (0),
    created_at      DATETIME2(3) NOT NULL CONSTRAINT DF_chat_sessions_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at      DATETIME2(3) NOT NULL CONSTRAINT DF_chat_sessions_updated_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_chat_sessions_users FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT CK_chat_sessions_trial CHECK (
        (is_trial = 1 AND user_id IS NULL)
        OR
        (is_trial = 0 AND user_id IS NOT NULL)
    ),
    CONSTRAINT CK_chat_sessions_status CHECK (status IN (N'trial_active', N'trial_depleted', N'member_active', N'closed')),
    CONSTRAINT CK_chat_sessions_trial_query_count CHECK (trial_query_count >= 0 AND trial_query_count <= 3)
);
GO

CREATE TABLE chat_messages (
    message_id      INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    session_id      INT NOT NULL,
    sender_type     NVARCHAR(20) NOT NULL,
    content         NVARCHAR(MAX) NOT NULL,
    created_at      DATETIME2(3) NOT NULL CONSTRAINT DF_chat_messages_created_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_chat_messages_sessions FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id) ON DELETE CASCADE,
    CONSTRAINT CK_chat_messages_sender CHECK (sender_type IN (N'USER', N'ASSISTANT', N'SYSTEM'))
);
GO

------------------------------------------------
-- 12. AI CONTENT MODERATION
------------------------------------------------
CREATE TABLE content_moderations (
    moderation_id   INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    content_id      INT NOT NULL,
    ai_flagged      BIT NOT NULL CONSTRAINT DF_content_moderations_ai_flagged DEFAULT (1),
    ai_reason       NVARCHAR(MAX) NULL,
    ai_confidence   DECIMAL(5,4) NULL,
    status          NVARCHAR(20) NOT NULL CONSTRAINT DF_content_moderations_status DEFAULT (N'pending'),
    reviewed_by     INT NULL,
    reviewed_at     DATETIME2(3) NULL,
    admin_note      NVARCHAR(MAX) NULL,
    created_at      DATETIME2(3) NOT NULL CONSTRAINT DF_content_moderations_created_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_content_moderations_content UNIQUE (content_id),
    CONSTRAINT FK_content_moderations_contents FOREIGN KEY (content_id) REFERENCES contents(content_id) ON DELETE CASCADE,
    CONSTRAINT FK_content_moderations_users FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL,
    CONSTRAINT CK_content_moderations_status CHECK (status IN (N'pending', N'approved', N'rejected')),
    CONSTRAINT CK_content_moderations_confidence CHECK (ai_confidence IS NULL OR (ai_confidence >= 0.0000 AND ai_confidence <= 1.0000))
);
GO

------------------------------------------------
-- INDEXES
------------------------------------------------
CREATE NONCLUSTERED INDEX IX_users_role_id              ON users(role_id);
CREATE NONCLUSTERED INDEX IX_contents_user_id           ON contents(user_id);
CREATE NONCLUSTERED INDEX IX_contents_status            ON contents(status) INCLUDE (title, content_type, created_at);
CREATE NONCLUSTERED INDEX IX_contents_type_status       ON contents(content_type, status);

CREATE NONCLUSTERED INDEX IX_comments_content_id        ON comments(content_id);
CREATE NONCLUSTERED INDEX IX_comments_parent_id         ON comments(parent_id);
CREATE NONCLUSTERED INDEX IX_votes_content_id           ON votes(content_id);

CREATE NONCLUSTERED INDEX IX_ingredients_category_id    ON ingredients(category_id);
CREATE NONCLUSTERED INDEX IX_dishes_category_id         ON dishes(category_id);
CREATE NONCLUSTERED INDEX IX_recipes_dish_id            ON recipes(dish_id);
CREATE NONCLUSTERED INDEX IX_recipes_status             ON recipes(status);

CREATE NONCLUSTERED INDEX IX_weekly_menus_user_date     ON weekly_menus(user_id, start_date);
CREATE NONCLUSTERED INDEX IX_weekly_menus_status         ON weekly_menus(status);
CREATE NONCLUSTERED INDEX IX_weekly_menu_meals_menu     ON weekly_menu_meals(menu_id);
CREATE NONCLUSTERED INDEX IX_weekly_menu_items_meal     ON weekly_menu_items(meal_id);
CREATE NONCLUSTERED INDEX IX_weekly_menu_items_dish     ON weekly_menu_items(dish_id);

CREATE NONCLUSTERED INDEX IX_restaurant_dishes_dish     ON restaurant_dishes(dish_id);
CREATE NONCLUSTERED INDEX IX_restaurants_city           ON restaurants(city);
CREATE NONCLUSTERED INDEX IX_restaurants_is_active      ON restaurants(is_active);

CREATE NONCLUSTERED INDEX IX_chat_messages_session      ON chat_messages(session_id, created_at);
CREATE NONCLUSTERED INDEX IX_chat_sessions_status        ON chat_sessions(status);
CREATE NONCLUSTERED INDEX IX_content_moderations_status ON content_moderations(status) WHERE status = N'pending';
GO
