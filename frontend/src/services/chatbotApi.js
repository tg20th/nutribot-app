import { apiRequest, ApiError, unwrapData } from './apiClient';

export class ChatbotApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'ChatbotApiError';
    this.status = status;
    this.payload = payload;
  }
}

export const getChatSessions = async (signal) => unwrapData(await apiRequest('/api/v1/chatbot/sessions', { signal }), []);
export const createChatSession = async () => unwrapData(await apiRequest('/api/v1/chatbot/sessions', { method: 'POST' }), null);
export const getChatMessages = async (sessionId, signal) => unwrapData(await apiRequest(`/api/v1/chatbot/sessions/${sessionId}/messages`, { signal }), []);
export const saveChatMessage = async (sessionId, senderType, content) => unwrapData(await apiRequest(`/api/v1/chatbot/sessions/${sessionId}/messages`, {
  method: 'POST', body: JSON.stringify({ senderType, content }),
}), null);

export async function requestNutritionAdvice({ message, sessionId, conversationHistory = [], signal }) {
  try {
    const response = await apiRequest('/api/v1/chatbot/query', {
      method: 'POST',
      signal,
      body: JSON.stringify({ sessionId, message, conversationHistory }),
    });
    return unwrapData(response, {});
  } catch (error) {
    if (error instanceof ApiError) {
      throw new ChatbotApiError(error.message, error.status, error.payload);
    }
    throw error;
  }
}
