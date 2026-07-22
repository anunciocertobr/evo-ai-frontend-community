import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import i18n from '@/i18n/config';
import { getEvent, getEventLabel } from '@/lib/events-manifest';
import AutomationEventSelector from './automation/EventSelector';
import type { AutomationRuleFormData } from '@/pages/Customer/Automation/registries';

// Cross-screen single-source-of-truth guard (EVO-1263 AC2).
//
// Multiple screens touch `event_name` and MUST read the label/category for a
// canonical event from the same manifest (getEventLabel / getEvent), so labels
// never drift between screens. This spec mounts a real consumer — Automation
// Rules (snake_case enum, manifest labels) — and asserts its rendered label
// for `contact.created` matches the manifest directly (the single source of
// truth every screen is required to defer to).
//
// NOTE: Contact History (`ContactEventsFilters`) used to be the second
// consumer exercised here (dot-notation `event_name` dropdown), but the
// Contacts detail-page relayout (full-page + Jornada panel) dropped that
// dropdown in favor of a simpler Tipo/Período filter — event-name filtering
// is no longer exposed in that screen's UI. `getEvent`/`getEventLabel`
// remain the single source of truth for any screen that still surfaces
// event names (Automation today).

class ResizeObserverPolyfill {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? (ResizeObserverPolyfill as never);
if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

vi.mock('@/services/campaigns/campaignsService', () => ({
  campaignsService: { list: vi.fn().mockResolvedValue({ data: [] }), get: vi.fn() },
}));

// The campaign filter is permission-gated; grant everything so the parity
// assertions keep exercising the full filter row.
vi.mock('@/contexts/PermissionsContext', () => ({
  usePermissions: () => ({ can: () => true, isReady: true, loading: false }),
}));

function AutomationWrapper() {
  const { control } = useForm<AutomationRuleFormData>({
    defaultValues: { event_name: 'contact_created' },
  });
  return <AutomationEventSelector control={control} />;
}

describe('event manifest consumers — cross-screen label parity (EVO-1263)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('renders contact.created with the manifest label in Automation', async () => {
    const user = userEvent.setup();
    const expectedLabel = getEventLabel('contact.created', 'en');

    render(<AutomationWrapper />);
    await user.click(screen.getByRole('combobox'));
    expect(
      within(await screen.findByRole('listbox')).getByText(expectedLabel),
    ).toBeInTheDocument();
  });

  it('exposes a single category for a canonical event (consumed identically)', () => {
    expect(getEvent('contact.created')?.category).toBe('contact');
    expect(getEvent('conversation.activity')?.category).toBe('conversation');
  });
});
