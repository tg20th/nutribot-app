import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestNutritionAdvice } from '../chatbotApi';

describe('chatbotApi gateway request', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    localStorage.clear();
  });

  it('posts chat to the Spring gateway and unwraps the API response', async () => {
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true, data: { sessionId: 12, reply: 'Eat vegetables', remainingTrialCount: 2 } }),
    });
    const history = [{ sender: 'USER', content: 'Hello' }];

    const response = await requestNutritionAdvice({
      message: 'What should I eat?',
      sessionId: 'guest-session',
      conversationHistory: history,
    });

    expect(response.reply).toBe('Eat vegetables');
    expect(response.remainingTrialCount).toBe(2);
    expect(fetch).toHaveBeenCalledWith('/api/v1/chatbot/query', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ sessionId: 'guest-session', message: 'What should I eat?', conversationHistory: history }),
    }));
  });

  it('converts gateway API errors to ChatbotApiError and forwards abort signals', async () => {
    const controller = new AbortController();
    fetch.mockResolvedValue({
      ok: false,
      status: 429,
      headers: { get: () => 'application/json' },
      json: async () => ({ message: 'Guest quota exceeded' }),
    });

    await expect(requestNutritionAdvice({ message: 'Test', sessionId: 'guest', signal: controller.signal }))
      .rejects.toMatchObject({ name: 'ChatbotApiError', status: 429 });
    expect(fetch).toHaveBeenCalledWith('/api/v1/chatbot/query', expect.objectContaining({ signal: controller.signal }));
  });
});
