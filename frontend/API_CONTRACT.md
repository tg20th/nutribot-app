# NutriBot REST API contract

All successful resource responses use `{ "data": ... }`. Configure `VITE_API_BASE_URL` to the Postman Mock Server URL (without a trailing slash).

| Method | Path | Used by |
|---|---|---|
| GET | `/api/blogs` | Home |
| GET | `/api/videos` | Home |
| GET | `/api/categories` | Home/community filters |
| GET | `/api/posts` | Community feed/profile |
| POST | `/api/posts` | Community composer |
| GET | `/api/posts/{id}` | Community detail |
| GET, POST | `/api/posts/{id}/comments` | Community detail/post cards |
| POST, DELETE | `/api/posts/{id}/votes` | Post cards/detail |
| GET, PUT | `/api/v1/users/profile` | Personal profile/navigation |
| PUT, DELETE | `/api/v1/users/profile/avatar` | Profile avatar upload/removal |
| GET | `/api/weekly-menus/current` | Weekly planner |
| PUT | `/api/weekly-menus/{id}` | Planner persistence |
| GET | `/api/restaurants` | Community right rail |
| GET | `/api/admin/dashboard?range=7d` | Admin dashboard |
| GET | `/api/admin/users` and `/api/admin/users/{id}` | Admin members |
| PATCH | `/api/admin/users/{id}/status` | Member moderation |
| GET, POST | `/api/admin/categories` | Category management |
| PUT, DELETE | `/api/admin/categories/{id}` | Category management |
| GET | `/api/admin/blogs`, `/api/admin/videos`, `/api/admin/comments` | Admin content/moderation |
| GET, DELETE | `/api/admin/blogs/{id}`, `/api/admin/videos/{id}`, `/api/admin/comments/{id}` | Admin details/moderation |
| PATCH | `/api/admin/blogs/{id}/status`, `/api/admin/videos/{id}/status` | Content moderation |

## Postman examples

`GET /api/blogs`

```json
{"data":[{"id":"BLG-1","title":"Plant protein basics","description":"A practical guide.","imageUrl":"https://example.com/blog.jpg","author":{"name":"NutriBot","username":"nutribot","avatarUrl":"https://example.com/avatar.jpg"},"createdAt":"2026-09-24T10:00:00Z","likeCount":15,"commentCount":3,"categories":["Protein"]}]}
```

`GET /api/posts/{id}`

```json
{"data":{"id":"p1","type":"video","title":"Crispy tofu","description":"A quick dinner.","imageUrl":"https://example.com/tofu.jpg","author":{"name":"Chef Lee","username":"cheflee","avatarUrl":"https://example.com/lee.jpg"},"calories":320,"protein":22,"likeCount":10,"commentCount":2,"pantryItems":["Tofu"],"steps":["Cook tofu"],"nutrition":{"carbs":"24g","fat":"16g"}}}
```

`GET /api/weekly-menus/current`

```json
{"data":{"id":"menu-1","week":{"range":"Sep 21 - 27, 2026","avgCalories":2000,"avgProtein":75},"groceryList":{"itemCount":12},"days":[{"label":"Mon","date":"Sep 21","calorieGoal":2000,"calorieActual":1900,"proteinGoal":75,"proteinActual":70,"meals":[{"slot":"Breakfast","name":"Oats","kcal":350,"protein":12,"image":"https://example.com/oats.jpg"}]}]}}
```

For mutations, Postman should return the created/updated resource in `data`; DELETE may return `204 No Content`.
