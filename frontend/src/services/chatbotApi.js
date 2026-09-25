const aiBaseUrl = (import.meta.env.VITE_AI_API_BASE_URL ?? '').replace(/\/$/, '');

export class ChatbotApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'ChatbotApiError';
    this.status = status;
    this.payload = payload;
  }
}

export async function requestNutritionAdvice({
  message,
  sessionId,
  userContext,
  conversationHistory = [],
  signal,
}) {
  const response = await fetch(`${aiBaseUrl}/api/ai/chat`, {
    method: 'POST',
    signal,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      session_id: sessionId,
      user_context: userContext,
      conversation_history: conversationHistory,
    }),
  });

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw new ChatbotApiError(
      payload?.message || `NutriBot request failed (${response.status})`,
      response.status,
      payload,
    );
  }

  return payload;
}
