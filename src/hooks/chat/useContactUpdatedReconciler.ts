import { useCallback, useEffect, useRef } from 'react';
import { contactsService } from '@/services/contacts/contactsService';
import type { Contact, Conversation } from '@/types/chat/api';

const RECONCILE_DEBOUNCE_MS = 250;

interface ContactUpdatedReconcilerParams {
  conversations: Conversation[];
  selectedConversationData: Conversation | null;
  /** `account.settings.mask_contact_pii`. */
  maskingEnabled: boolean;
  apply: (contact: Contact) => void;
}

interface RestContact {
  id?: string;
  name?: string;
  email?: string | null;
  phone_number?: string | null;
  thumbnail?: string | null;
  avatar_url?: string | null;
  custom_attributes?: Record<string, unknown>;
  additional_attributes?: unknown;
}

const sameId = (a: string | number | null | undefined, b: string): boolean =>
  a !== null && a !== undefined && String(a) === b;

function toStoreContact(id: string, rest: RestContact): Contact {
  return {
    id: String(rest.id ?? id),
    name: rest.name ?? '',
    email: rest.email ?? null,
    phone_number: rest.phone_number ?? null,
    // The contact serializer emits the avatar as `thumbnail`.
    avatar_url: rest.thumbnail ?? rest.avatar_url ?? null,
    custom_attributes: (rest.custom_attributes ?? {}) as Record<string, unknown>,
    additional_attributes: rest.additional_attributes ?? {},
  } as Contact;
}

/**
 * Turns a `contact.updated` frame into the contact this session is entitled to
 * see.
 *
 * The broadcast is masked by the account flag alone, because its audience is
 * the whole account token; the REST endpoints mask per request and hand an
 * admin the raw value. Refetching resolves that divergence per session without
 * a per-audience broadcast. It replaces the frame rather than following it, so
 * the masked value never reaches the store even for one paint.
 */
export function useContactUpdatedReconciler({
  conversations,
  selectedConversationData,
  maskingEnabled,
  apply,
}: ContactUpdatedReconcilerParams): (frameContact: Contact) => void {
  const paramsRef = useRef({ conversations, selectedConversationData, maskingEnabled, apply });
  paramsRef.current = { conversations, selectedConversationData, maskingEnabled, apply };

  const timersRef = useRef<Record<string, number>>({});
  const inFlightRef = useRef<Set<string>>(new Set());
  const pendingRef = useRef<Record<string, Contact>>({});
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const timers = timersRef.current;
    const pending = pendingRef.current;
    const inFlight = inFlightRef.current;

    return () => {
      mountedRef.current = false;
      Object.values(timers).forEach(timerId => window.clearTimeout(timerId));
      Object.keys(timers).forEach(key => delete timers[key]);
      Object.keys(pending).forEach(key => delete pending[key]);
      inFlight.clear();
    };
  }, []);

  const isInStore = useCallback((contactId: string): boolean => {
    const { conversations: list, selectedConversationData: selected } = paramsRef.current;
    const belongs = (conv: Conversation | null): boolean =>
      !!conv && (sameId(conv.contact?.id, contactId) || sameId(conv.meta?.sender?.id, contactId));

    return list.some(belongs) || belongs(selected);
  }, []);

  const runRefetch = useCallback((contactId: string) => {
    const frameContact = pendingRef.current[contactId];
    if (!frameContact) {
      return;
    }

    delete pendingRef.current[contactId];
    inFlightRef.current.add(contactId);

    contactsService
      .getContact(contactId, false)
      .then(rest => {
        if (!mountedRef.current) return;
        paramsRef.current.apply(toStoreContact(contactId, rest as unknown as RestContact));
      })
      .catch(err => {
        console.error('[contact.updated] Failed to reconcile contact via REST:', err);
        if (!mountedRef.current) return;
        // Masked but current beats leaving a stale name on screen. A frame that
        // landed mid-flight is newer than the one this request carried.
        paramsRef.current.apply(pendingRef.current[contactId] ?? frameContact);
      })
      .finally(() => {
        inFlightRef.current.delete(contactId);
        if (mountedRef.current && pendingRef.current[contactId]) {
          scheduleRef.current(contactId);
        }
      });
  }, []);

  const schedule = useCallback(
    (contactId: string) => {
      const existing = timersRef.current[contactId];
      if (existing) {
        window.clearTimeout(existing);
      }

      timersRef.current[contactId] = window.setTimeout(() => {
        delete timersRef.current[contactId];
        if (inFlightRef.current.has(contactId)) {
          return;
        }
        runRefetch(contactId);
      }, RECONCILE_DEBOUNCE_MS);
    },
    [runRefetch],
  );

  const scheduleRef = useRef(schedule);
  scheduleRef.current = schedule;

  return useCallback(
    (frameContact: Contact) => {
      if (!frameContact?.id) {
        return;
      }

      const contactId = String(frameContact.id);

      // A contact outside the store is applied rather than dropped: the reducer
      // ignores what it cannot match, and this snapshot can be one render behind.
      if (!paramsRef.current.maskingEnabled || !isInStore(contactId)) {
        paramsRef.current.apply(frameContact);
        return;
      }

      pendingRef.current[contactId] = frameContact;
      schedule(contactId);
    },
    [isInStore, schedule],
  );
}
