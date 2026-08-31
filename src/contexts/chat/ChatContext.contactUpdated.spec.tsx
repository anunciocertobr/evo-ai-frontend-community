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

const getContact = vi.fn();

vi.mock('@/services/contacts/contactsService', () => ({
  contactsService: {
    getContact: (...args: unknown[]) => getContact(...args),
  },
}));

import { ChatProvider, useChatContext } from './ChatContext';
import { useAppDataStore } from '@/store/appDataStore';

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
    getContact.mockReset();
    useAppDataStore.setState({ account: null });
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

  it('with masking on, the store takes the REST contact and never the masked frame', async () => {
    useAppDataStore.setState({
      account: { settings: { mask_contact_pii: true } },
    } as unknown as Parameters<typeof useAppDataStore.setState>[0]);
    getContact.mockResolvedValue({
      id: 'contact-1',
      name: 'João Silva',
      thumbnail: null,
      custom_attributes: {},
      additional_attributes: {},
    });

    render(
      <ChatProvider>
        <Probe />
      </ChatProvider>,
    );

    expect(screen.getByTestId('name').textContent).toBe('553140204020');

    await act(async () => {
      capturedHandlers.onContactUpdated?.({
        id: 'contact-1',
        name: '55******4020',
        account_id: 'account-1',
        custom_attributes: {},
        additional_attributes: {},
      });
      await new Promise(resolve => setTimeout(resolve, 300));
    });

    expect(getContact).toHaveBeenCalledWith('contact-1', false);
    expect(screen.getByTestId('name').textContent).toBe('João Silva');
  });

  it('with masking off, the frame is applied without a refetch', async () => {
    render(
      <ChatProvider>
        <Probe />
      </ChatProvider>,
    );

    await act(async () => {
      capturedHandlers.onContactUpdated?.({
        id: 'contact-1',
        name: 'João Silva',
        account_id: 'account-1',
        custom_attributes: {},
        additional_attributes: {},
      });
      await new Promise(resolve => setTimeout(resolve, 300));
    });

    expect(getContact).not.toHaveBeenCalled();
    expect(screen.getByTestId('name').textContent).toBe('João Silva');
  });
});
