import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import type { Conversation } from '@/types/chat/api';

// Capture the handlers the WebSocketProvider hands to the socket layer, so the
// test can push a real contact.updated frame through the whole chain.
let capturedHandlers: Record<string, ((data: unknown) => void) | undefined> = {};

vi.mock('@/hooks/chat/useWebSocket', () => ({
  useWebSocket: (_userId: string, _token: string, opts: { handlers?: typeof capturedHandlers }) => {
    capturedHandlers = opts?.handlers ?? {};
    return { isConnected: false, sendTypingOn: vi.fn(), sendTypingOff: vi.fn() };
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', pubsub_token: 'token-1' } }),
}));

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

import { ChatProvider, useChatContext } from './ChatContext';

// REST payload shape: `contact` present, no `meta` (ConversationSerializer).
const restConversation = {
  id: 'conv-rest',
  uuid: 'conv-rest',
  display_id: '1',
  status: 'open',
  contact: { id: 'contact-1', name: '553140204020' },
} as unknown as Conversation;

function Probe() {
  const chat = useChatContext();
  const { setConversations, state } = chat.conversations;

  React.useEffect(() => {
    setConversations([restConversation]);
  }, [setConversations]);

  return <span data-testid="name">{state.conversations[0]?.contact?.name ?? ''}</span>;
}

describe('ChatContext contact.updated end-to-end', () => {
  beforeEach(() => {
    capturedHandlers = {};
    localStorage.clear();
  });

  it('a contact.updated frame renames the contact of a REST-loaded conversation', async () => {
    render(
      <ChatProvider>
        <Probe />
      </ChatProvider>,
    );

    expect(screen.getByTestId('name').textContent).toBe('553140204020');

    // Covers the hop the unit specs miss: ChatContext registering the provider
    // handler onto updateContactInConversations.
    await act(async () => {
      capturedHandlers.onContactUpdated?.({
        id: 'contact-1',
        name: 'João Silva',
        account_id: 'account-1',
        custom_attributes: {},
        additional_attributes: {},
      });
    });

    expect(screen.getByTestId('name').textContent).toBe('João Silva');
  });
});
