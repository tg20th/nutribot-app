from app.prompts import build_user_prompt, detect_conversation_language
from app.schemas.chat import ChatRequest, ConversationMessage


def request(message, history=()):
    return ChatRequest(
        message=message,
        session_id="language-regression",
        conversation_history=list(history),
    )


def test_language_follows_latest_user_turn_instead_of_first_turn():
    history = [
        ConversationMessage(sender="USER", content="What are vegetarian protein sources?"),
        ConversationMessage(sender="ASSISTANT", content="Tofu and beans are useful sources."),
    ]
    assert detect_conversation_language(request("Vậy người mới bắt đầu ăn chay nên ăn gì?", history)) == "vi"
    assert detect_conversation_language(request("What should I eat for breakfast?", history)) == "en"


def test_explicit_language_request_overrides_detection():
    assert detect_conversation_language(request("Please answer in Vietnamese: what should I eat?")) == "vi"
    assert detect_conversation_language(request("Hãy trả lời bằng tiếng Anh: tôi nên ăn gì?")) == "en"


def test_prompt_preserves_history_and_describes_latest_turn_language_policy():
    prompt = build_user_prompt(request("Vậy còn bữa tối thì sao?", [
        ConversationMessage(sender="USER", content="What should I eat for lunch?"),
    ]))
    assert '"selected_response_language":"vi"' in prompt
    assert "most recent message" in prompt
    assert "conversation_history" in prompt
