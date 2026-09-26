import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ChatbotWidget from '../ChatbotWidget';

// Mock gsap
vi.mock('gsap', () => ({
  default: {
    to: vi.fn((target, options, onComplete) => {
      if (onComplete) onComplete();
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

  it('history button exists', async () => {
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

  describe('Guest Trial Limit', () => {
    it('does not show trial badge for logged in users', () => {
      localStorage.setItem('nutribot-auth-token', 'fake-jwt-token');
      renderWithRouter(<ChatbotWidget />);
      const launcher = screen.getByRole('button', { name: /open nutribot chat/i });
      fireEvent.click(launcher);

      const badge = document.querySelector('.chatbot-widget__trial-badge');
      expect(badge).not.toBeInTheDocument();
    });

    it('shows trial badge after first message for guests', async () => {
      // Guest: no token
      localStorage.clear();
      localStorage.setItem('nutribot_guest_trial_count', '2');

      renderWithRouter(<ChatbotWidget />);
      const launcher = screen.getByRole('button', { name: /open nutribot chat/i });
      fireEvent.click(launcher);

      const badge = document.querySelector('.chatbot-widget__trial-badge');
      expect(badge).toBeInTheDocument();
      expect(badge.textContent).toContain('2/3 questions left');
    });
  });
});
