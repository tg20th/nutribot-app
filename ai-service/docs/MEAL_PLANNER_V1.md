# Deterministic Meal Planner V1

The canonical endpoint is POST /api/ai/generate-meal-plan. It is DB-independent, uses canonical dish IDs only, runs vegetarian/allergy filtering before CP-SAT weekly planning, and does not call Gemini or persist data.

Gemini remains available only for unrelated AI-service features; it is not in the Meal Planner execution path.

Backend supplies only vegetarianType, allergyIngredientIds, nutritionTarget, and canonicalDishes. AI-service owns eligibility, deterministic vegetarian/allergy safety, PlannerConfig, CP-SAT, timeout, weekly planning, and final validation. Backend does not supply CP-SAT/planning configuration.

PlannerConfig is NB54_POLICY_V1: BREAKFAST/LUNCH/DINNER; daily calories ±10%, protein/carbs/fat ±20%; daily repetition 1, weekly repetition 2, minimum 14 distinct dishes, deterministic one-worker CP-SAT timeout 5 seconds. Candidate limit is NONE/NEEDS_LOAD_TEST; dish-to-slot compatibility is NOT ENFORCED/NEEDS_PRODUCT_DECISION. V2 has no Gemini or DB dependency.
