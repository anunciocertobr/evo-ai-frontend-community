import { useCallback, useEffect, useRef } from 'react';
import { contactsService } from '@/services/contacts/contactsService';
import type { Contact, Conversation } from '@/types/chat/api';

// A burst on the same contact (rename + label + block) is three frames; coalesce
// them into one refetch. Per contact id, never global: two different contacts
// changing at the same time must not collapse into a single request.
const RECONCILE_DEBOUNCE_MS = 250;

interface ContactUpdatedReconcilerParams {
  conversations: Conversation[];
  selectedConversationData: Conversation | null;
  /** `account.settings.mask_contact_pii` — the same flag the server reads. */
  maskingEnabled: boolean;
  apply: (contact: Contact) => void;
}

const sameId = (a: string | number | null | undefined, b: string): boolean =>
  a !== null && a !== undefined && String(a) === b;

// The REST payload keys the chat store reads. `thumbnail` is what the contact
// serializer emits for the avatar; the websocket mapping already normalises it
// to `avatar_url`, so do the same here or the avatar disappears on reconcile.
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

function toStoreContact(id: string, rest: RestContact): Contact {
  return {
    id: String(rest.id ?? id),
    name: rest.name ?? '',
    email: rest.email ?? null,
    phone_number: rest.phone_number ?? null,
    avatar_url: rest.thumbnail ?? rest.avatar_url ?? null,
    custom_attributes: (rest.custom_attributes ?? {}) as Record<string, unknown>,
    additional_attributes: rest.additional_attributes ?? {},
  } as Contact;
}

/**
 * Reconciles a `contact.updated` frame against the REST contact before it
 * reaches the chat store.
 *
 * The broadcast masks PII by the account flag alone — its audience is the whole
 * account token, admins and agents on the same topic — while the REST endpoints
 * mask per request and hand an admin the raw value. Applying the frame directly
 * therefore makes an admin watch the contact mask itself live and come back raw
 * on refresh. Refetching gives each session the version it is entitled to
 * without opening a per-audience broadcast — the path that already cost four
 * rounds of leak regressions and is documented at the top of the server's
 * contact_pii_masker.
 *
 * The refetch replaces the frame instead of following it, so the masked value
 * never reaches the store — patching after would flash it on screen.
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
    // Captured on mount: these containers are never reassigned, so the cleanup
    // acts on the very objects this render created.
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

  // `contact.updated` is broadcast on the account token, so a client receives it
  // for every contact in the account — including contacts it has never loaded.
  // Refetching those would be one request per connected client per change, for a
  // patch the reducer would drop anyway.
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
        // Keeping the realtime update is worth more than the flapping it brings
        // back: the frame is masked but current, and dropping it would leave the
        // stale name on screen, which is the bug the realtime wiring exists to
        // prevent.
        console.error('[contact.updated] Failed to reconcile contact via REST:', err);
        if (!mountedRef.current) return;
        paramsRef.current.apply(frameContact);
      })
      .finally(() => {
        inFlightRef.current.delete(contactId);
        // A frame that landed mid-flight describes a change the response could
        // not have carried, so it earns its own round.
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

  // `runRefetch` re-arms the debounce through this ref to keep the two callbacks
  // from depending on each other.
  const scheduleRef = useRef(schedule);
  scheduleRef.current = schedule;

  return useCallback(
    (frameContact: Contact) => {
      if (!frameContact?.id) {
        return;
      }

      const contactId = String(frameContact.id);

      // With the flag off — the default — frame and REST carry the same values,
      // so there is nothing to reconcile and no request to spend.
      //
      // A contact outside the store is applied straight through rather than
      // dropped: the reducer already ignores what it cannot match, and a store
      // snapshot that is one render behind must never swallow a real update.
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
