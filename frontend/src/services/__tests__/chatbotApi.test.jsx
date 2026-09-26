import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestNutritionAdvice, ChatbotApiError } from '../chatbotApi';

describe('chatbotApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ChatbotApiError', () => {
    it('creates error with message, status and payload', () => {
      const error = new ChatbotApiError('Test error', 400, { detail: 'Bad request' });
      expect(error.message).toBe('Test error');
      expect(error.status).toBe(400);
      expect(error.payload).toEqual({ detail: 'Bad request' });
      expect(error.name).toBe('ChatbotApiError');
    });
  });

  describe('requestNutritionAdvice', () => {
    it('sends message to AI API and returns response', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: {
            get: () => 'application/json',
          },
          json: () => Promise.resolve({
            reply: 'Eat more vegetables',
            recommendations: ['Broccoli', 'Spinach'],
          }),
        })
      );

      const response = await requestNutritionAdvice({
        message: 'What should I eat?',
        sessionId: 'test-session',
        conversationHistory: [],
      });

      expect(response.reply).toBe('Eat more vegetables');
      expect(response.recommendations).toHaveLength(2);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/ai/chat'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            message: 'What should I eat?',
            session_id: 'test-session',
            user_context: undefined,
            conversation_history: [],
          }),
        })
      );
    });

    it('throws ChatbotApiError on non-OK response', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 503,
          headers: {
            get: () => 'application/json',
          },
          json: () => Promise.resolve({ message: 'Service unavailable' }),
        })
      );

      await expect(
        requestNutritionAdvice({ message: 'Test', sessionId: 'test' })
      ).rejects.toThrow(ChatbotApiError);
    });

    it('includes conversation history in request', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ reply: 'Test', recommendations: [] }),
        })
      );

      const history = [
        { sender: 'USER', content: 'Hello' },
        { sender: 'ASSISTANT', content: 'Hi!' },
      ];

      await requestNutritionAdvice({
        message: 'Continue',
        sessionId: 'test',
        conversationHistory: history,
      });

      const call = global.fetch.mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.conversation_history).toEqual(history);
    });

    it('passes abort signal to fetch', async () => {
      const abortController = new AbortController();

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ reply: 'OK', recommendations: [] }),
        })
      );

      await requestNutritionAdvice({
        message: 'Test',
        sessionId: 'test',
        signal: abortController.signal,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ signal: abortController.signal })
      );
    });
  });
});
