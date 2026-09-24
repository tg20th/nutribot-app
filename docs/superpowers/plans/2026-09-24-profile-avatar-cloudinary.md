# Profile Avatar Cloudinary Implementation Plan

> **For agentic workers:** Implement one task at a time. After each task, stop for the user's review and wait for explicit approval before continuing. Do not commit unless the user asks.

**Goal:** Let a signed-in NutriBot user select an avatar image, upload it through Spring Boot to Cloudinary, and store the returned HTTPS URL in `users.avatar_url`.

**Architecture:** React provides file selection and a local preview. The browser sends the selected image as multipart form data to Spring Boot; the backend validates it, uploads with the official Cloudinary Java SDK, and updates only the authenticated user's `avatar_url`. Cloudinary credentials stay on the backend, and the application database stores the delivery URL rather than image bytes.

**Tech Stack:** React 19, Vite, Spring Boot 4.1.1, Java 25, Spring MVC multipart upload, Spring Data JPA, Microsoft SQL Server, Cloudinary Java SDK 2.x using `cloudinary-http5`.

**Spec:** `docs/superpowers/specs/2026-09-24-profile-avatar-cloudinary-design.md`

## Global Constraints

- Store image bytes in Cloudinary and store only its HTTPS `secure_url` in `users.avatar_url`.
- Accept PNG, JPEG, or WebP images up to 5 MB.
- Never expose `CLOUDINARY_API_SECRET` or upload signatures to React.
- Identify the user from the authenticated principal; never accept a client-selected user ID for this operation.
- Return API success and error payloads using the `ApiResponse<T>` shape in `API_CONTRACTS.md`.
- Preserve the old avatar URL if validation or Cloudinary upload fails.
- Do not commit unless the user requests a commit.
- Complete exactly one task, then stop for user review and approval.

## Repository Preconditions

- `User`, `Role`, `UserRepository`, profile services/controllers, and datasource configuration are not present in this checkout. The user supplied `User` and `Role` source definitions in the task description. This plan proposes `UserRepository`, `CloudinaryConfig`, and `CloudinaryAvatarService`; confirm any naming or source mismatch with the user before implementing the affected task.
- The task list marks `NB-08` as blocked by `NB-11`; the authentication backend tasks `NB-02`, `NB-05`, and `NB-06` are also prerequisites for a real authenticated upload. Build the UI preview task independently. Do not weaken user ownership checks to work around missing auth; stop at the backend integration task until those dependencies are available.
- The current backend `application.properties` contains only the application name. Use environment placeholders for database and Cloudinary credentials; do not insert secrets into tracked files.
- Cloudinary's official Java SDK repository currently lists `com.cloudinary:cloudinary-http5:2.3.1`, and its Java guide recommends the `cloudinary-http5` package for general Java applications. Recheck the official release page immediately before dependency installation.

## Review Focus

1. Invalid MIME type or misleading file extension: reject before Cloudinary upload (Task 1 and Task 3).
2. File larger than 5 MB: reject in the browser and again in Spring Boot without replacing the current avatar (Task 1 and Task 3).
3. Cloudinary unavailable or credentials missing: report a safe error and retain the previous URL (Task 2 and Task 3).
4. Unauthenticated request or request attempting to target another user: reject or ignore any supplied user ID and only use the authenticated principal (Task 3).
5. User cancels after selecting a file: discard the local preview and release its object URL without changing the saved avatar (Task 1 and Task 4).

---

### Task 1: Add local avatar file selection and preview

**Files:**
- Modify: `frontend/src/pages/ProfilePage.jsx`
- Modify: `frontend/src/pages/ProfilePage.css`

**Interfaces:**
- Consumes: Current `ProfileEditDialog({ profile, onClose, onSave })` in `ProfilePage.jsx`.
- Produces: A selected image preview, local checks for PNG/JPEG/WebP and 5 MB maximum, and a cancel path that does not update the displayed profile.

- [ ] Add an image file input with `accept="image/png,image/jpeg,image/webp"`; keep the existing profile URL out of editable text inputs.
- [ ] Reject files whose declared MIME type is not PNG/JPEG/WebP or whose size exceeds 5 MB, and show an inline message beside the picker.
- [ ] Create a preview with `URL.createObjectURL(file)` and revoke it when replaced, cancelled, or the dialog unmounts.
- [ ] Keep profile text save separate from avatar upload; do not store the temporary object URL in profile state or present it as a persisted avatar.
- [ ] Run `npm.cmd run build` from `frontend/`.
- [ ] Open `http://127.0.0.1:5173/`, open Edit Profile, select an allowed image and confirm preview; try an invalid type and an oversized file; cancel and confirm the profile avatar did not change.

**Expected:** The dialog previews valid local images, rejects invalid files with a visible message, and cancellation leaves the displayed profile unchanged. No API call is made in this task.

---

### Task 2: Configure Cloudinary and add the upload adapter

**Files:**
- Modify: `backend/pom.xml`
- Modify: `backend/src/main/resources/application.properties`
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/config/CloudinaryConfig.java`
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/service/CloudinaryAvatarService.java`

**Interfaces:**
- Consumes: An image `MultipartFile` and a user ID supplied by the authenticated application service.
- Produces: Nested record `CloudinaryAvatarService.AvatarUploadResult(String secureUrl, String publicId)`; the secret remains in backend configuration.

- [ ] Add `com.cloudinary:cloudinary-http5:2.3.1` to Maven, after confirming the release remains current in Cloudinary's official Java SDK repository.
- [ ] Bind `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` from environment variables; fail upload with a clear configuration error if any value is missing.
- [ ] Implement `CloudinaryAvatarService.uploadAvatar(MultipartFile file, Integer userId)` using image resource type, a `nutribot/avatars` folder, and a unique public ID derived from the user ID plus a random suffix; return nested record `AvatarUploadResult(String secureUrl, String publicId)`.
- [ ] Implement `CloudinaryAvatarService.deleteAvatar(String publicId)` for cleanup if a new upload succeeds but its database write fails. Never log credentials or raw image contents.
- [ ] Run `backend/mvnw.cmd -f backend/pom.xml -DskipTests package` from the repository root.

**Expected:** Backend compiles with the Cloudinary SDK and has one isolated server-side adapter that can return the Cloudinary URL. No endpoint or frontend network call is added in this task.

---

### Task 3: Add the authenticated avatar upload endpoint and database update

**Files:**
- Create or update: `backend/src/main/java/com/fpt/swp391/nutribot/entity/User.java` using the user-provided mapping, including `avatarUrl` mapped to `avatar_url` and `bio` mapped to `bio`.
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/entity/Role.java` using the user-provided mapping if not supplied by the branch merged for this task.
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/repository/UserRepository.java`.
- Create or update: `backend/src/main/java/com/fpt/swp391/nutribot/service/UserProfileService.java`.
- Create or update: `backend/src/main/java/com/fpt/swp391/nutribot/controller/UserProfileController.java`.
- Create if absent: `backend/src/main/java/com/fpt/swp391/nutribot/common/ApiResponse.java`.
- Create: `backend/src/main/java/com/fpt/swp391/nutribot/dto/response/AvatarResponse.java`.
- Modify: `backend/src/main/resources/application.properties` for environment-driven SQL Server and multipart configuration.

**Interfaces:**
- Consumes: `CloudinaryAvatarService.uploadAvatar(MultipartFile, Integer)` and `deleteAvatar(String)` from Task 2; `UserRepository.findByUsername(String)`; authenticated principal username from the project's completed Spring Security/JWT setup.
- Produces: `UserProfileService.updateAvatar(String username, MultipartFile file)` and `PUT /api/v1/users/profile/avatar` with multipart part `file`; success response data contains `avatarUrl`.

- [ ] Before editing, inspect the integrated `NB-11` user persistence and `NB-05`/`NB-06` authentication work. Reuse their exact entity, repository, and principal conventions; if they are still absent, stop and ask before creating competing auth/persistence implementations.
- [ ] Implement `UserRepository.findByUsername(String username)` and `UserProfileService.updateAvatar(String username, MultipartFile file)`. Resolve `Authentication.getName()` through the established repository query; do not accept user ID in the path, query, or body.
- [ ] Check empty file, declared content type, decoded image format, and 5 MB size before calling Cloudinary. Enforce the same size at Spring multipart configuration.
- [ ] Upload to Cloudinary, update only the current user's `avatar_url`, and save. If persistence fails after upload, call `deleteAvatar` with the returned transient `public_id`; never delete the previously saved avatar in this version.
- [ ] Return HTTP 200 with `ApiResponse` containing `{ "avatarUrl": "<secure_url>" }`; return 400 for invalid files, 401 for unauthenticated requests, and 502 for Cloudinary failures without exposing provider credentials/details.
- [ ] Run `backend/mvnw.cmd -f backend/pom.xml -DskipTests package` from the repository root.
- [ ] With the required SQL Server and Cloudinary environment variables configured and a valid authenticated session, upload a valid image, then GET the profile and confirm the saved URL; try an invalid/oversized file and confirm the previous URL remains.

**Expected:** Only the authenticated user's avatar URL changes after a successful provider upload and database save. Missing auth, invalid files, provider errors, and database errors do not replace the current avatar.

---

### Task 4: Connect the profile dialog to the upload endpoint

**Files:**
- Modify: `frontend/src/pages/ProfilePage.jsx`
- Modify: `frontend/src/pages/ProfilePage.css`
- Create or update: the existing frontend API/auth client only after locating the real token storage and API base URL in the integrated frontend branch.

**Interfaces:**
- Consumes: `PUT /api/v1/users/profile/avatar` with multipart part `file`, authenticated using the existing frontend auth mechanism.
- Produces: Upload status, retryable error display, and profile avatar update from the returned `avatarUrl`.

- [ ] Inspect the integrated frontend authentication code for its token source and API base URL. Do not invent local-storage keys or send an unauthenticated request; if authentication code is not present, stop and ask before this task.
- [ ] Add an explicit Upload Photo action for the selected file; send `FormData` with part name `file` and the existing Bearer token. Do not set the multipart `Content-Type` header manually.
- [ ] Disable duplicate upload while pending and show loading state. On success, replace the displayed avatar with the returned `avatarUrl` and clear the temporary preview; on failure keep the previous avatar and selected file so the user can retry.
- [ ] Keep profile text Save/Cancel behavior separate from avatar upload; do not claim database persistence for local-only profile text fields.
- [ ] Run `npm.cmd run build` from `frontend/`.
- [ ] Open the browser with an authenticated session and verify successful upload, cancel-before-upload, invalid file, oversize file, provider failure, and retry behavior.

**Expected:** The popup uploads an image only after the user chooses Upload Photo; the profile changes only after the API confirms success. Text profile edits retain their existing local-only behavior until the separate profile API task is implemented.

## Handoff Notes

- A task is not permission to continue to the next task. Stop after each task for user review and explicit approval.
- Do not commit or push unless the user explicitly asks.
- The upload integration cannot be completed safely until the `NB-11` persistence and `NB-05`/`NB-06` authentication dependencies, plus the frontend token source, are available.
