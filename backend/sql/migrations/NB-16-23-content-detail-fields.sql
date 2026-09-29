-- NB-16/NB-23: lưu đủ dữ liệu hiển thị ở trang chi tiết Blog/Video.
ALTER TABLE contents ADD
    prep_time_min INT NULL,
    cook_time_min INT NULL,
    servings INT NULL,
    calories INT NULL,
    protein_g DECIMAL(8,2) NULL,
    carbs_g DECIMAL(8,2) NULL,
    fat_g DECIMAL(8,2) NULL,
    fiber_g DECIMAL(8,2) NULL,
    sodium_mg DECIMAL(8,2) NULL,
    ingredients_json NVARCHAR(MAX) NULL,
    steps_json NVARCHAR(MAX) NULL;
GO

ALTER TABLE contents ADD CONSTRAINT CK_contents_recipe_times
    CHECK ((prep_time_min IS NULL OR prep_time_min >= 0) AND (cook_time_min IS NULL OR cook_time_min >= 0));
GO
ALTER TABLE contents ADD CONSTRAINT CK_contents_servings CHECK (servings IS NULL OR servings > 0);
GO
