from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.schemas.recipe_extraction import ModelRecipeExtraction


class StubExtractionGemini:
    def __init__(self, payload: ModelRecipeExtraction | None = None) -> None:
        self.payload = payload or ModelRecipeExtraction.model_validate(
            {
                "dish": {
                    "name": "Bún gạo lứt rau củ",
                    "description": "Món chay nhẹ bụng",
                    "serving_size": 1,
                    "serving_unit": "bowl",
                },
                "nutrition": {
                    "calories": 418,
                    "protein_g": 15.8,
                    "carbs_g": 64.2,
                    "fat_g": 11.6,
                    "fiber_g": 9.4,
                },
                "ingredients": [
                    {"name": "Bún gạo lứt", "quantity": 90, "unit": "g", "notes": None}
                ],
                "recipe": {
                    "title": "Bún gạo lứt rau củ",
                    "prep_time_min": 12,
                    "cook_time_min": 10,
                    "servings": 1,
                    "steps": ["Ngâm bún", "Áp chảo rau củ"],
                },
            }
        )
        self.model_name = "stub"

    def _get_client(self):
        return object()

    async def _generate_with_fallback(self, client, prompt, config):
        return SimpleNamespace(parsed=self.payload)


def test_extract_recipe_endpoint_returns_structured_data():
    app = create_app(
        settings=Settings(gemini_api_key="test-key"),
        gemini_service=StubExtractionGemini(),
    )

    response = TestClient(app).post(
        "/api/ai/extract-recipe",
        json={
            "content_id": 82,
            "content_type": "BLOG",
            "title": "Bún gạo lứt rau củ",
            "body": "Nguyên liệu: bún gạo lứt, đậu hũ non, bông cải xanh...",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["dish"]["name"] == "Bún gạo lứt rau củ"
    assert payload["data"]["nutrition"]["calories"] == 418
    assert payload["data"]["ingredients"][0]["name"] == "Bún gạo lứt"
    assert payload["data"]["recipe"]["steps"][0] == "Ngâm bún"


def test_extract_recipe_blank_title_is_rejected():
    app = create_app(
        settings=Settings(gemini_api_key="test-key"),
        gemini_service=StubExtractionGemini(),
    )

    response = TestClient(app).post(
        "/api/ai/extract-recipe",
        json={"content_id": 1, "content_type": "BLOG", "title": "   "},
    )

    assert response.status_code == 422
    assert response.json()["success"] is False


def test_extract_recipe_non_recipe_content_stays_empty():
    empty = ModelRecipeExtraction.model_validate(
        {"dish": {"name": ""}, "ingredients": []}
    )
    app = create_app(
        settings=Settings(gemini_api_key="test-key"),
        gemini_service=StubExtractionGemini(payload=empty),
    )

    response = TestClient(app).post(
        "/api/ai/extract-recipe",
        json={"content_id": 5, "content_type": "VIDEO", "title": "Chia sẻ về lối sống"},
    )

    assert response.status_code == 200
    assert response.json()["data"]["dish"]["name"] == ""
    assert response.json()["data"]["ingredients"] == []


def test_extract_recipe_without_api_key_returns_503():
    app = create_app(settings=Settings(gemini_api_key=None))

    response = TestClient(app).post(
        "/api/ai/extract-recipe",
        json={"content_id": 1, "content_type": "BLOG", "title": "Salad"},
    )

    assert response.status_code == 503
