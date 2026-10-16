import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ChatbotWidget from '../ChatbotWidget';

// Mock gsap
vi.mock('gsap', () => ({
  default: {
    to: vi.fn((_target, options) => {
      options?.onComplete?.();
    }),
    fromTo: vi.fn(),
    timeline: vi.fn(() => ({
      fromTo: vi.fn().mockReturnThis(),
      defaults: vi.fn().mockReturnThis(),
    })),
    set: vi.fn(),
  },
}));

vi.mock('@gsap/react', () => ({
  useGSAP: vi.fn((callback, options) => {
    callback();
  }),
}));

// Mock chatbotApi
vi.mock('../../../services/chatbotApi', () => ({
  createChatSession: vi.fn(() => Promise.resolve({ sessionId: 'test-session-123' })),
  getChatMessages: vi.fn(() => Promise.resolve([
    { messageId: 1, senderType: 'USER', content: 'Hello', createdAt: '2024-01-01' },
    { messageId: 2, senderType: 'ASSISTANT', content: 'Hi there!', createdAt: '2024-01-01' },
  ])),
  getChatSessions: vi.fn(() => Promise.resolve([
    { sessionId: 'session-1', title: 'Test Session', preview: 'Hello', updatedAt: '2024-01-01T10:00:00Z' },
    { sessionId: 'session-2', title: 'Another Chat', preview: 'What about lunch?', updatedAt: '2024-01-02T10:00:00Z' },
  ])),
  requestNutritionAdvice: vi.fn(() => Promise.resolve({
    reply: 'Here is some nutrition advice',
    remainingTrialCount: 2,
    recommendations: ['Eat more vegetables', 'Drink water'],
  })),
  saveChatMessage: vi.fn(() => Promise.resolve()),
}));

const renderWithRouter = (ui) => render(<BrowserRouter>{ui}</BrowserRouter>);

describe('ChatbotWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('renders the chatbot launcher button', () => {
    renderWithRouter(<ChatbotWidget />);
    const launcher = screen.getByRole('button', { name: /open nutribot chat/i });
    expect(launcher).toBeInTheDocument();
  });

  it('launcher is initially closed', () => {
    renderWithRouter(<ChatbotWidget />);
    const launcher = screen.getByRole('button', { name: /open nutribot chat/i });
    expect(launcher).toHaveAttribute('aria-expanded', 'false');
  });

  it('launcher has correct aria attributes', () => {
    renderWithRouter(<ChatbotWidget />);
    const launcher = screen.getByRole('button', { name: /open nutribot chat/i });

    expect(launcher).toHaveAttribute('aria-label', 'Open NutriBot chat');
    expect(launcher).toHaveAttribute('aria-controls', 'nutribot-chat-panel');
  });

  it('widget panel exists in DOM after click', async () => {
    renderWithRouter(<ChatbotWidget />);
    const launcher = screen.getByRole('button', { name: /open nutribot chat/i });

    fireEvent.click(launcher);

    // Panel should exist (with animation-based visibility handled by GSAP mock)
    const panel = document.getElementById('nutribot-chat-panel');
    expect(panel).toBeInTheDocument();
  });

  it('returns the launcher to the compact viewport anchor after closing fullscreen', async () => {
    renderWithRouter(<ChatbotWidget />);
    const launcher = screen.getByRole('button', { name: /open nutribot chat/i });

    fireEvent.click(launcher);
    fireEvent.click(screen.getByRole('button', { name: /expand nutribot chat/i }));
    expect(document.querySelector('.chatbot-widget')).toHaveClass('is-fullscreen');

    fireEvent.click(screen.getByRole('button', { name: /close nutribot chat/i }));

    await waitFor(() => {
      expect(document.getElementById('nutribot-chat-panel')).not.toBeInTheDocument();
      expect(document.querySelector('.chatbot-widget')).not.toHaveClass('is-fullscreen');
      expect(screen.getByRole('button', { name: /open nutribot chat/i })).toHaveAttribute('aria-expanded', 'false');
    });

    fireEvent.click(screen.getByRole('button', { name: /open nutribot chat/i }));
    expect(document.querySelector('.chatbot-widget')).not.toHaveClass('is-fullscreen');
  });

  it('shows welcome message in the widget', async () => {
    renderWithRouter(<ChatbotWidget />);
    const launcher = screen.getByRole('button', { name: /open nutribot chat/i });

    fireEvent.click(launcher);

    // The welcome text is rendered in the panel
    const welcomeText = document.getElementById('nutribot-chat-panel');
    expect(welcomeText).toBeInTheDocument();
  });

  it('has message input field', async () => {
    renderWithRouter(<ChatbotWidget />);
    const launcher = screen.getByRole('button', { name: /open nutribot chat/i });

    fireEvent.click(launcher);

    const input = document.querySelector('#nutribot-message');
    expect(input).toBeInTheDocument();
  });

  it('send button exists', async () => {
    renderWithRouter(<ChatbotWidget />);
    const launcher = screen.getByRole('button', { name: /open nutribot chat/i });

    fireEvent.click(launcher);

    const sendButton = document.querySelector('button[type="submit"]');
    expect(sendButton).toBeInTheDocument();
  });

  it('rejects whitespace-only messages and applies the backend message limit', async () => {
    const { requestNutritionAdvice } = await import('../../../services/chatbotApi');
    renderWithRouter(<ChatbotWidget />);
    fireEvent.click(screen.getByRole('button', { name: /open nutribot chat/i }));
    const input = screen.getByLabelText(/message nutribot/i);

    expect(input).toHaveAttribute('maxLength', '2000');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.submit(input.closest('form'));
    expect(requestNutritionAdvice).not.toHaveBeenCalled();
  });

  it('turns an incomplete successful response into an error instead of a fake assistant answer', async () => {
    const { requestNutritionAdvice } = await import('../../../services/chatbotApi');
    requestNutritionAdvice.mockResolvedValueOnce({});
    renderWithRouter(<ChatbotWidget />);
    fireEvent.click(screen.getByRole('button', { name: /open nutribot chat/i }));
    fireEvent.click(screen.getByRole('button', { name: /build a balanced plate/i }));

    await waitFor(() => expect(screen.getByText(/incomplete response/i)).toBeInTheDocument());
    expect(screen.queryByText(/could not provide a response/i)).not.toBeInTheDocument();
  });

  it('times out a pending request, clears typing, and offers retry', async () => {
    const { requestNutritionAdvice } = await import('../../../services/chatbotApi');
    requestNutritionAdvice.mockImplementationOnce(() => new Promise(() => {}));
    vi.useFakeTimers();
    renderWithRouter(<ChatbotWidget />);
    fireEvent.click(screen.getByRole('button', { name: /open nutribot chat/i }));
    fireEvent.click(screen.getByRole('button', { name: /build a balanced plate/i }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(screen.queryByText(/phản hồi quá lâu/i)).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(screen.getByText(/phản hồi quá lâu/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeEnabled();
    expect(document.querySelector('.chatbot-widget__typing')).not.toBeInTheDocument();
  });

  it('keeps a YouTube video request alive beyond the text timeout', async () => {
    const { requestNutritionAdvice } = await import('../../../services/chatbotApi');
    requestNutritionAdvice.mockImplementationOnce(() => new Promise(() => {}));
    localStorage.setItem('nutribot-auth-token', 'fake-jwt-token');
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('https://youtu.be/dQw4w9WgXcQ');
    vi.useFakeTimers();
    renderWithRouter(<ChatbotWidget />);
    fireEvent.click(screen.getByRole('button', { name: /open nutribot chat/i }));
    fireEvent.click(screen.getByRole('button', { name: /add attachment/i }));
    fireEvent.click(screen.getByRole('button', { name: /paste youtube link/i }));
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(screen.queryByText(/taking too long/i)).not.toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(109_999); });
    expect(screen.queryByText(/taking too long/i)).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(screen.getByText(/phản hồi quá lâu/i)).toBeInTheDocument();
    promptSpy.mockRestore();
  });

  it('retries without adding another user message', async () => {
    const { requestNutritionAdvice } = await import('../../../services/chatbotApi');
    requestNutritionAdvice
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ reply: 'Recovered answer', remainingTrialCount: 2 });
    renderWithRouter(<ChatbotWidget />);
    fireEvent.click(screen.getByRole('button', { name: /open nutribot chat/i }));
    const input = screen.getByLabelText(/message nutribot/i);
    fireEvent.change(input, { target: { value: 'Can I retry this?' } });
    fireEvent.submit(input.closest('form'));

    await waitFor(() => expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(screen.getByText('Recovered answer')).toBeInTheDocument());
    expect(screen.getAllByText('Can I retry this?')).toHaveLength(1);
    expect(requestNutritionAdvice).toHaveBeenCalledTimes(2);
    expect(requestNutritionAdvice.mock.calls[0][0].idempotencyKey)
      .toBe(requestNutritionAdvice.mock.calls[1][0].idempotencyKey);
  });

  it('sends a YouTube link as a video url attachment', async () => {
    const { requestNutritionAdvice } = await import('../../../services/chatbotApi');
    localStorage.setItem('nutribot-auth-token', 'fake-jwt-token');
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('https://youtu.be/dQw4w9WgXcQ');
    renderWithRouter(<ChatbotWidget />);
    fireEvent.click(screen.getByRole('button', { name: /open nutribot chat/i }));
    fireEvent.click(screen.getByRole('button', { name: /add attachment/i }));
    fireEvent.click(screen.getByRole('button', { name: /paste youtube link/i }));
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => expect(requestNutritionAdvice).toHaveBeenCalledWith(expect.objectContaining({
      attachment: { type: 'VIDEO', url: 'https://youtu.be/dQw4w9WgXcQ' },
    })));
    promptSpy.mockRestore();
  });

  it('does not append an old response after a member switches sessions', async () => {
    const { requestNutritionAdvice } = await import('../../../services/chatbotApi');
    let resolveRequest;
    requestNutritionAdvice.mockImplementationOnce(() => new Promise((resolve) => { resolveRequest = resolve; }));
    localStorage.setItem('nutribot-auth-token', 'fake-jwt-token');
    renderWithRouter(<ChatbotWidget />);
    fireEvent.click(screen.getByRole('button', { name: /open nutribot chat/i }));
    const input = screen.getByLabelText(/message nutribot/i);
    fireEvent.change(input, { target: { value: 'Old session request' } });
    fireEvent.submit(input.closest('form'));
    fireEvent.click(document.querySelector('.chatbot-widget__history-toggle'));
    await waitFor(() => expect(screen.getByText('Test Session')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Test Session'));
    await waitFor(() => expect(screen.getByText('Hi there!')).toBeInTheDocument());

    resolveRequest({ reply: 'Old response should not appear' });
    await Promise.resolve();
    expect(screen.queryByText('Old response should not appear')).not.toBeInTheDocument();
  });

  it('history button exists', async () => {
    localStorage.setItem('nutribot-auth-token', 'fake-jwt-token');
    renderWithRouter(<ChatbotWidget />);
    const launcher = screen.getByRole('button', { name: /open nutribot chat/i });

    fireEvent.click(launcher);

    const historyButton = document.querySelector('.chatbot-widget__history-toggle');
    expect(historyButton).toBeInTheDocument();
  });

  it('quick prompts are rendered', async () => {
    renderWithRouter(<ChatbotWidget />);
    const launcher = screen.getByRole('button', { name: /open nutribot chat/i });

    fireEvent.click(launcher);

    const prompts = document.querySelectorAll('.chatbot-widget__prompt');
    expect(prompts.length).toBe(4);
  });

  it('renders an existing conversation without the welcome state or prompts', async () => {
    localStorage.setItem('nutribot-auth-token', 'fake-jwt-token');
    renderWithRouter(<ChatbotWidget />);
    fireEvent.click(screen.getByRole('button', { name: /open nutribot chat/i }));
    fireEvent.click(document.querySelector('.chatbot-widget__history-toggle'));

    await waitFor(() => expect(screen.getByText('Test Session')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Test Session'));

    await waitFor(() => expect(screen.getByText('Hi there!')).toBeInTheDocument());
    expect(screen.queryByText('Small choices, made clearer.')).not.toBeInTheDocument();
    expect(document.querySelector('.chatbot-widget__prompts')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/message nutribot/i)).toBeInTheDocument();
  });

  it('shows conversation loading without inserting the welcome message', async () => {
    const { getChatMessages } = await import('../../../services/chatbotApi');
    let resolveMessages;
    getChatMessages.mockImplementationOnce(() => new Promise((resolve) => { resolveMessages = resolve; }));
    localStorage.setItem('nutribot-auth-token', 'fake-jwt-token');
    renderWithRouter(<ChatbotWidget />);
    fireEvent.click(screen.getByRole('button', { name: /open nutribot chat/i }));
    fireEvent.click(document.querySelector('.chatbot-widget__history-toggle'));
    await waitFor(() => expect(screen.getByText('Test Session')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Test Session'));

    expect(screen.getByText('Loading conversation...')).toBeInTheDocument();
    expect(screen.queryByText('Small choices, made clearer.')).not.toBeInTheDocument();

    await act(async () => {
      resolveMessages([
        { messageId: 1, senderType: 'USER', content: 'History question', createdAt: '2024-01-01' },
      ]);
    });
    await waitFor(() => expect(screen.getByText('History question')).toBeInTheDocument());
  });

  it('restores the welcome state when starting a new conversation after history', async () => {
    localStorage.setItem('nutribot-auth-token', 'fake-jwt-token');
    renderWithRouter(<ChatbotWidget />);
    fireEvent.click(screen.getByRole('button', { name: /open nutribot chat/i }));
    fireEvent.click(document.querySelector('.chatbot-widget__history-toggle'));
    await waitFor(() => expect(screen.getByText('Test Session')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Test Session'));
    await waitFor(() => expect(screen.getByText('Hi there!')).toBeInTheDocument());

    fireEvent.click(document.querySelector('.chatbot-widget__history-toggle'));
    await waitFor(() => expect(screen.getByText('NEW CONVERSATION')).toBeInTheDocument());
    fireEvent.click(screen.getByText('NEW CONVERSATION'));

    expect(screen.getByText('Small choices, made clearer.')).toBeInTheDocument();
    expect(document.querySelectorAll('.chatbot-widget__prompt')).toHaveLength(4);
  });

  describe('Guest and member behavior', () => {
    it('does not show trial badge for logged in users', () => {
      localStorage.setItem('nutribot-auth-token', 'fake-jwt-token');
      renderWithRouter(<ChatbotWidget />);
      const launcher = screen.getByRole('button', { name: /open nutribot chat/i });
      fireEvent.click(launcher);

      const badge = document.querySelector('.chatbot-widget__trial-badge');
      expect(badge).not.toBeInTheDocument();
    });

    it('does not expose member chat history to guests', () => {
      renderWithRouter(<ChatbotWidget />);
      fireEvent.click(screen.getByRole('button', { name: /open nutribot chat/i }));
      expect(document.querySelector('.chatbot-widget__history-toggle')).not.toBeInTheDocument();
    });

    it('uses the remaining trial count returned by the API', async () => {
      renderWithRouter(<ChatbotWidget />);
      fireEvent.click(screen.getByRole('button', { name: /open nutribot chat/i }));
      fireEvent.click(screen.getByRole('button', { name: /build a balanced plate/i }));
      await waitFor(() => {
        expect(document.querySelector('.chatbot-widget__trial-badge')).toHaveTextContent('2 of 3 questions left');
      });
    });

    it('shows the registration modal after the API reports no guest trials left', async () => {
      const { requestNutritionAdvice } = await import('../../../services/chatbotApi');
      requestNutritionAdvice.mockResolvedValueOnce({ reply: 'Last free answer', remainingTrialCount: 0 });
      renderWithRouter(<ChatbotWidget />);
      fireEvent.click(screen.getByRole('button', { name: /open nutribot chat/i }));
      fireEvent.click(screen.getByRole('button', { name: /build a balanced plate/i }));
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /your free trial has ended/i })).toBeInTheDocument();
      });
    });

    it('shows the registration modal when the guest API returns a limit response', async () => {
      const { requestNutritionAdvice } = await import('../../../services/chatbotApi');
      const limitError = new Error('Limit reached');
      limitError.status = 429;
      requestNutritionAdvice.mockRejectedValueOnce(limitError);
      renderWithRouter(<ChatbotWidget />);
      fireEvent.click(screen.getByRole('button', { name: /open nutribot chat/i }));
      fireEvent.click(screen.getByRole('button', { name: /build a balanced plate/i }));
      await waitFor(() => {
        expect(screen.getByRole('dialog', { name: /your free trial has ended/i })).toBeInTheDocument();
      });
    });

    it('closes the exhausted guest chatbot before opening the login flow', async () => {
      const { requestNutritionAdvice } = await import('../../../services/chatbotApi');
      const onAuth = vi.fn();
      requestNutritionAdvice.mockResolvedValueOnce({ reply: 'Last free answer', remainingTrialCount: 0 });
      renderWithRouter(<ChatbotWidget onAuth={onAuth} />);
      fireEvent.click(screen.getByRole('button', { name: /open nutribot chat/i }));
      fireEvent.click(screen.getByRole('button', { name: /build a balanced plate/i }));
      await waitFor(() => expect(screen.getByRole('dialog', { name: /your free trial has ended/i })).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /log in/i }));

      expect(onAuth).toHaveBeenCalledWith('login');
      expect(document.getElementById('nutribot-chat-panel')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /open nutribot chat/i })).toHaveAttribute('aria-expanded', 'false');
    });

    it('does not fabricate a quota when the API omits trial metadata', async () => {
      const { requestNutritionAdvice } = await import('../../../services/chatbotApi');
      requestNutritionAdvice.mockResolvedValueOnce({ reply: 'Answer without quota metadata' });
      renderWithRouter(<ChatbotWidget />);
      fireEvent.click(screen.getByRole('button', { name: /open nutribot chat/i }));
      fireEvent.click(screen.getByRole('button', { name: /build a balanced plate/i }));
      await waitFor(() => expect(screen.getByText(/answer without quota metadata/i)).toBeInTheDocument());
      expect(document.querySelector('.chatbot-widget__trial-badge')).not.toBeInTheDocument();
    });

    it('returns focus to the launcher after Escape closes the panel', async () => {
      renderWithRouter(<ChatbotWidget />);
      const launcher = screen.getByRole('button', { name: /open nutribot chat/i });
      fireEvent.click(launcher);
      document.querySelector('#nutribot-message').focus();
      fireEvent.keyDown(window, { key: 'Escape' });
      await waitFor(() => expect(launcher).toHaveFocus());
    });

    it('keeps guest quota unchanged when NutriBot cannot answer', async () => {
      const { requestNutritionAdvice } = await import('../../../services/chatbotApi');
      requestNutritionAdvice.mockRejectedValueOnce(new Error('AI unavailable'));

      renderWithRouter(<ChatbotWidget />);
      fireEvent.click(screen.getByRole('button', { name: /open nutribot chat/i }));
      fireEvent.click(screen.getByRole('button', { name: /build a balanced plate/i }));

      await waitFor(() => expect(screen.getByText(/NutriBot could not respond right now/i)).toBeInTheDocument());
      expect(document.querySelector('.chatbot-widget__trial-badge')).not.toBeInTheDocument();
    });
  });
});
