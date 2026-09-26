# NutriBot session context

Updated: 2026-09-26

## Project and working conventions

- Repository: `tg20th/swp391-group7-nutribot`, SWP391 Group 7, Jira project `NB`.
- Current branch: `feat/NB-08-profile-thang`.
- Follow the repository `AGENTS.md`: branch format `feat/NB-<id>-<short-name>-<member>` / `fix/...`; commit messages must be 100% Vietnamese and use the prescribed format. Do not commit or push unless explicitly asked.
- The user prefers incremental work with review points and wants UI-facing text in English. Keep their existing main-branch UI and authentication flow intact when working on NB-08.

## NB-08 profile work and project history

- NB-08 is the personal user profile feature: load the signed-in user's saved data, edit profile details, and persist changes to the database. The UI uses the existing profile page design and the user's supplied profile screenshots as references.
- The profile page was added/updated at `frontend/src/pages/ProfilePage.jsx`; profile API calls are in `frontend/src/services/profileApi.js` and use the shared `frontend/src/services/apiClient.js`.
- Backend profile endpoints include authenticated GET/PUT `/api/v1/users/profile`, avatar PUT/DELETE `/api/v1/users/profile/avatar`, and separate health-profile operations. The profile service persists account fields and `UserProfile` data, and avatar uploads use Cloudinary with the returned URL stored in the database.
- The user previously reported a React runtime failure (`React is not defined`); the page was fixed and subsequently rendered. They also asked that Google login/register modal and routing behavior from main remain usable, and profile inspection should not require editing routes.
- NB-08 work was committed previously (including `feat(NB-08-BE): hoàn thiện API hồ sơ và kết nối giao diện #done`) and pushed. The user asked for a PR and Jira/context updates in earlier work. Current HEAD is merge commit `7519a0a`, and branch is aligned with `origin/feat/NB-08-profile-thang` according to the last observed Git state.
- An avatar removal defect was diagnosed and fixed in committed code: persist the cleared avatar URL first, then attempt Cloudinary cleanup so a cleanup failure does not roll back the DB update. The user authorized regression tests for that earlier fix.
- There have been earlier local DB/JDBC, registration, JWT, CORS, and backend-startup problems. Historical remedies included checking the NutriBotV2 schema and sample data; fixing the JWT HS512 key length; resolving the database role name (`User` versus `ROLE_USER`); avoiding a stale/nonexistent `roles.created_at` mapping; and preserving the existing login/register flow. Keep separate symptoms separate rather than assuming old errors remain.

## Recent backend/auth recovery work present in the working tree

These changes were restored/edited after the user reported database/profile data problems. They are currently **uncommitted**:

- `backend/src/main/java/com/fpt/swp391/nutribot/config/JwtAuthenticationFilter.java`: normalize DB role names (`User`/`Admin`) to Spring authorities `ROLE_USER`/`ROLE_ADMIN`.
- `backend/src/main/java/com/fpt/swp391/nutribot/entity/Role.java`: remove the mapping to a `created_at` column not present in the known NutriBotV2 roles schema.
- `backend/src/main/java/com/fpt/swp391/nutribot/repository/UserRepository.java`: fetch role with username lookup using an entity graph, avoiding lazy role access outside its persistence context.
- `backend/src/main/java/com/fpt/swp391/nutribot/service/AuthService.java`: allow the database role name `User` as the default user role.
- `backend/src/main/resources/application.properties`: set a valid >=512-bit Base64 default JWT signing key for HS512 (64 decoded bytes); the key value is intentionally not copied into this context file.
- `frontend/vite.config.js`: proxy `/api` to `http://127.0.0.1:8080`.
- Restored untracked tests: `backend/src/test/java/com/fpt/swp391/nutribot/config/JwtAuthenticationFilterTest.java` and `backend/src/test/java/com/fpt/swp391/nutribot/service/UserProfileServiceTest.java`.

Previously, `mvn -o test` passed 5 tests and frontend `npm run build` passed (with an existing chunk-size warning). Those results predate the latest CORS change and do not validate a live authenticated profile update.

## Current reported issue: PUT and avatar upload return 403

- User confirmed GET `/api/v1/users/profile` now loads the user's database data in the UI, but editing profile data and uploading an image return 403.
- The frontend fetch client adds `Authorization: Bearer <token>` from local storage key `nutribot-auth-token`; profile edit uses PUT JSON and avatar upload uses PUT multipart form data to `/api/v1/users/profile/avatar`.
- Root cause was verified against the live backend at `127.0.0.1:8080`: Spring CORS only allowed `http://localhost:5173` and `http://localhost:3000`, while this Vite UI runs on port `5175`. OPTIONS preflight with origin `http://localhost:5175` returned 403; the same preflight from `http://localhost:5173` returned 200.
- Updated `backend/src/main/java/com/fpt/swp391/nutribot/config/SecurityConfig.java` to also allow `http://localhost:5175` and `http://127.0.0.1:5175`. This change is uncommitted.
- Backend Java process PID `13648` (started 2026-09-26 18:03) was still running with the old configuration during the check. It was intentionally not stopped because it may have been launched with user-specific Cloudinary settings. Restart backend to load the allowlist update, then log in and retry profile PUT and avatar upload.
- Maven compile was attempted using `mvn -o -DskipTests compile` but failed before compilation because Maven could not create its local repository at `C:\.m2\repository` (`LocalRepositoryNotAccessibleException`). Do not claim the latest config compiled or that a live PUT/upload succeeded.

## Current working-tree state (last observed)

Branch: `feat/NB-08-profile-thang`; HEAD: `7519a0a`.

Modified:

- `backend/src/main/java/com/fpt/swp391/nutribot/config/JwtAuthenticationFilter.java`
- `backend/src/main/java/com/fpt/swp391/nutribot/config/SecurityConfig.java`
- `backend/src/main/java/com/fpt/swp391/nutribot/entity/Role.java`
- `backend/src/main/java/com/fpt/swp391/nutribot/repository/UserRepository.java`
- `backend/src/main/java/com/fpt/swp391/nutribot/service/AuthService.java`
- `backend/src/main/resources/application.properties`
- `frontend/vite.config.js`

Untracked:

- `backend/src/test/java/com/fpt/swp391/nutribot/config/JwtAuthenticationFilterTest.java`
- `backend/src/test/java/com/fpt/swp391/nutribot/service/UserProfileServiceTest.java`

`context.md` did not exist at the start of this write, so this file is a new consolidated session record. Review `git status` before future edits/commits; avoid discarding these working-tree changes.

## Next steps

1. Restart backend using the user's normal run configuration so existing database and Cloudinary environment settings are preserved.
2. Retry profile update and avatar upload from the frontend on port 5175 while logged in.
3. If still failing, capture the exact request URL, status response body, and backend log; distinguish Spring authorization failure from CORS and application exceptions.
4. Resolve Maven's local repository path if compile verification is needed. Do not commit/push until the user asks.
