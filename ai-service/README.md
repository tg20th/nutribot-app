# NutriBot AI Service

FastAPI microservice cho nhiệm vụ NB-32, cung cấp tư vấn dinh dưỡng qua Google Gemini.

## Chạy nhanh trên Windows

Mở `ai-service/.env`, dán khóa vào dòng:

```env
GEMINI_API_KEY=khóa_của_bạn
```

Sau đó chạy:

```powershell
cd ai-service
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

Script tự tạo môi trường Python, cài dependency và mở service tại `http://localhost:8000`. Model chính là `gemini-3.8-flash`; khi model mới nhất quá tải, service tự chuyển sang `gemini-3.5-flash-lite` để ưu tiên khả năng phản hồi. Có thể thay đổi bằng `GEMINI_MODEL` và `GEMINI_FALLBACK_MODEL` trong `.env`.

## Cài đặt thủ công

Yêu cầu Python 3.12 trở lên.

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements-dev.txt
copy .env.example .env
uvicorn main:app --reload --port 8000
```

Điền `GEMINI_API_KEY` trong `.env` trước khi gọi chatbot. Có thể kiểm tra service mà không cần khóa tại `GET /health`; Swagger UI nằm tại `/docs`.

## API nội bộ

`POST /api/ai/chat`

```json
{
  "message": "Tôi dị ứng đậu phộng, có thể thay bằng gì?",
  "session_id": "session-1234",
  "user_context": {
    "bmi": 20.2,
    "allergies": ["Đậu phộng"]
  }
}
```

```json
{
  "reply": "Bạn có thể dùng sốt mè hoặc hạt hướng dương...",
  "recommendations": ["Sốt mè rang", "Sốt hạt hướng dương"]
}
```

`conversation_history` là trường tùy chọn, gồm tối đa 50 phần tử có dạng `{ "sender": "USER|ASSISTANT", "content": "..." }`. Service chỉ gửi số tin nhắn gần nhất theo `MAX_HISTORY_MESSAGES` sang Gemini để kiểm soát chi phí và độ dài ngữ cảnh.

## Kiểm thử

```bash
pytest -q
```

Các test sử dụng Gemini giả lập nên không cần khóa API và không phát sinh lời gọi mạng.
