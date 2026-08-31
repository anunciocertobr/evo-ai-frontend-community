import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Contact, Conversation } from '@/types/chat/api';

const getContact = vi.fn();

vi.mock('@/services/contacts/contactsService', () => ({
  contactsService: {
    getContact: (...args: unknown[]) => getContact(...args),
  },
}));

import { useContactUpdatedReconciler } from './useContactUpdatedReconciler';

// REST shape: `contact`, no `meta` (ConversationSerializer).
const conversation = {
  id: 'conv-1',
  contact: { id: 'contact-1', name: 'João Silva' },
} as unknown as Conversation;

// What the broadcast carries with the account flag on: masked for every
// audience, admins included.
const maskedFrame = {
  id: 'contact-1',
  name: '55******4020',
  email: 'j***@example.com',
  phone_number: '55******4020',
} as Contact;

const rawRestContact = {
  id: 'contact-1',
  name: '5531984204020',
  email: 'joao@example.com',
  phone_number: '5531984204020',
  thumbnail: 'https://cdn/avatar.png',
  custom_attributes: {},
  additional_attributes: {},
};

function setup(overrides: Partial<Parameters<typeof useContactUpdatedReconciler>[0]> = {}) {
  const apply = vi.fn();
  const { result, unmount } = renderHook(() =>
    useContactUpdatedReconciler({
      conversations: [conversation],
      selectedConversationData: null,
      maskingEnabled: true,
      apply,
      ...overrides,
    }),
  );
  return { reconcile: result.current, apply, unmount };
}

// Lets the debounce fire and the getContact promise settle.
async function flush() {
  await act(async () => {
    vi.advanceTimersByTime(300);
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useContactUpdatedReconciler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getContact.mockReset();
    getContact.mockResolvedValue(rawRestContact);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('applies the REST contact instead of the masked frame', async () => {
    const { reconcile, apply } = setup();

    act(() => reconcile(maskedFrame));
    // The masked value must never reach the store, not even for one paint.
    expect(apply).not.toHaveBeenCalled();

    await flush();

    expect(getContact).toHaveBeenCalledWith('contact-1', false);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply.mock.calls[0][0]).toMatchObject({
      id: 'contact-1',
      name: '5531984204020',
      email: 'joao@example.com',
      phone_number: '5531984204020',
      // `thumbnail` is the key the serializer emits; the store reads avatar_url.
      avatar_url: 'https://cdn/avatar.png',
    });
  });

  it('coalesces a burst on the same contact into a single refetch', async () => {
    const { reconcile, apply } = setup();

    act(() => {
      reconcile(maskedFrame);
      reconcile({ ...maskedFrame, name: '55******4021' });
      reconcile({ ...maskedFrame, name: '55******4022' });
    });
    await flush();

    expect(getContact).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('does not collapse different contacts into one request', async () => {
    const other = {
      id: 'conv-2',
      contact: { id: 'contact-2', name: 'Maria' },
    } as unknown as Conversation;
    const { reconcile } = setup({ conversations: [conversation, other] });

    act(() => {
      reconcile(maskedFrame);
      reconcile({ ...maskedFrame, id: 'contact-2' });
    });
    await flush();

    expect(getContact).toHaveBeenCalledTimes(2);
    expect(getContact.mock.calls.map(call => call[0]).sort()).toEqual(['contact-1', 'contact-2']);
  });

  it('applies the frame without fetching when masking is off', async () => {
    const { reconcile, apply } = setup({ maskingEnabled: false });

    act(() => reconcile(maskedFrame));
    await flush();

    expect(getContact).not.toHaveBeenCalled();
    expect(apply).toHaveBeenCalledWith(maskedFrame);
  });

  it('applies the frame without fetching for a contact outside the store', async () => {
    const { reconcile, apply } = setup({ conversations: [] });

    act(() => reconcile(maskedFrame));
    await flush();

    // No request: contact.updated is an account-wide broadcast, so most frames
    // are about contacts this client never loaded. The dispatch still goes
    // through — the reducer ignores what it cannot match, and a store snapshot
    // one render behind must not swallow a real update.
    expect(getContact).not.toHaveBeenCalled();
    expect(apply).toHaveBeenCalledWith(maskedFrame);
  });

  it('reconciles a contact matched through meta.sender', async () => {
    const wsBorn = {
      id: 'conv-ws',
      meta: { sender: { id: 'contact-1', name: '55******4020' } },
    } as unknown as Conversation;
    const { reconcile } = setup({ conversations: [wsBorn] });

    act(() => reconcile(maskedFrame));
    await flush();

    expect(getContact).toHaveBeenCalledTimes(1);
  });

  it('reconciles a contact that only the selected conversation holds', async () => {
    const { reconcile } = setup({ conversations: [], selectedConversationData: conversation });

    act(() => reconcile(maskedFrame));
    await flush();

    expect(getContact).toHaveBeenCalledTimes(1);
  });

  it('falls back to the frame when the refetch fails', async () => {
    getContact.mockRejectedValue(new Error('network down'));
    const { reconcile, apply } = setup();

    act(() => reconcile(maskedFrame));
    await flush();

    expect(apply).toHaveBeenCalledWith(maskedFrame);
  });

  it('does not touch the store after unmount', async () => {
    const { reconcile, apply, unmount } = setup();

    act(() => reconcile(maskedFrame));
    unmount();
    await flush();

    expect(apply).not.toHaveBeenCalled();
  });
});
