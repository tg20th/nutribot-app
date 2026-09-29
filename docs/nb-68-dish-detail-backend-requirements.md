# NB-68 Backend requirements

The existing dish catalog and Weekly Menu payload do not contain recipe details. Add authenticated read-only `GET /api/v1/dishes/{dishId}` in the standard `ApiResponse` envelope.

- Return `dishId`, `name`, optional `imageUrl`, `calories`, `proteinG`, `carbsG`, `fatG`, `servings`, `prepTimeMinutes`, and `cookTimeMinutes`.
- Return ordered `ingredients` entries: `{ name, quantity, unit }`.
- Return ordered `steps` entries: `{ stepNumber, description }`.
- Preserve stored order and return null for genuinely optional values. Never send placeholders.
- Return 401 unauthenticated, 403 forbidden, 404 missing/inactive dish. This endpoint must not mutate a Weekly Menu.
