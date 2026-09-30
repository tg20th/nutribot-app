# Deterministic Meal Planner Backend Handoff

## Existing endpoint

POST /api/ai/generate-meal-plan remains the only Meal Planner endpoint. Its request contract is upgraded; it no longer accepts the legacy Gemini request.

## Current Backend versus required request

| Required field | Current Backend payload | Status |
| --- | --- | --- |
| vegetarianType | not sent | MISSING_FROM_CURRENT_BACKEND_REQUEST |
| allergyIngredientIds | sends allergy names only | AVAILABLE_BUT_DIFFERENT_SHAPE |
| nutritionTarget | sends targetCalories only | AVAILABLE_BUT_DIFFERENT_SHAPE |
| canonicalDishes | sends dishId/name/calories/proteinG | AVAILABLE_BUT_DIFFERENT_SHAPE |

Backend must provide:

- vegetarianType: required string, one of VEGAN, LACTO, OVO, LACTO_OVO; sourced from Healthy Profile.
- allergyIngredientIds: required array of canonical ingredient IDs. [] means Backend confirms no IDs; omitted is invalid.
- nutritionTarget: required canonical NB-10 object: calories, proteinG, carbsG, fatG, estimated.
- canonicalDishes: required canonical records. Each requires dishId, name, servingSize, servingUnit, calories, proteinG, carbsG, healthyFatsG, vegetarianType, isActive, and ingredients[] with ingredientId/name. description, imageUrl, and categoryId are accepted optional metadata.

AI-service owns eligibility, vegetarian/allergy safety, PlannerConfig, CP-SAT, timeout, weekly planning, and validation. Backend must not send planner policy fields.

## Response change

The deterministic response has status, days[].meals[] using slot/dishId, nutritionTotal, deviation, weeklySummary, reasonCodes, and executionMetadata. It is not compatible with legacy breakfast/lunch/dinner plus servings response without Backend adaptation.

Until this payload and response migration occurs, the canonical endpoint returns controlled Pydantic validation errors rather than Gemini fallback.

## Final Backend to AI contract

Backend supplies data only to POST /api/ai/generate-meal-plan:

- vegetarianType: required supported dietary type.
- allergyIngredientIds: required array of canonical ingredient IDs; an explicit empty array is valid, while omission is fail-safe invalid.
- nutritionTarget: required canonical calories, proteinG, carbsG, fatG, and estimated values.
- canonicalDishes: required canonical dish records and canonical ingredient identities.

Request shape example (a successful NB54_POLICY_V1 plan requires at least 14 distinct safe canonical dishes; the single record below is intentionally shortened for readability):

    {"vegetarianType":"VEGAN","allergyIngredientIds":[],"nutritionTarget":{"calories":1800,"proteinG":90,"carbsG":225,"fatG":60,"estimated":false},"canonicalDishes":[{"dishId":12,"name":"Example tofu bowl","servingSize":1,"servingUnit":"portion","calories":600,"proteinG":30,"carbsG":75,"healthyFatsG":20,"vegetarianType":"VEGAN","isActive":true,"ingredients":[{"ingredientId":4,"name":"Tofu"}]}]}

Successful responses use status OPTIMAL or FEASIBLE and contain days with day, meals (slot and dishId), nutritionTotal, deviation, weeklySummary, reasonCodes, and executionMetadata. Controlled outcomes include INVALID_INPUT for malformed/missing canonical data, INFEASIBLE with NO_SAFE_CANDIDATES when safety removes all dishes, INFEASIBLE for valid unsatisfiable policy constraints, TIME_LIMIT_REACHED for no incumbent before the solver budget, and VALIDATION_FAILED if final deterministic validation rejects a solver result.

AI-service owns NB54_POLICY_V1, eligibility, safety, CP-SAT, timeout, planning, and validation. Backend owns canonical data retrieval and persistence. Backend currently uses the legacy request contract and must migrate; BE to AI cross-service integration is therefore pending. This does not block completion of the isolated deterministic AI implementation.
