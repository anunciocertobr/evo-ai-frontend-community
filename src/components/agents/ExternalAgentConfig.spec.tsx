import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExternalAgentConfig, { type ExternalAgentConfigData } from './ExternalAgentConfig';

// EVO-2250 story 2.3 (front): the external agent points at a vault credential
// by credential_id, and the inline secret keeps travelling as the fallback.

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (key: string) => key, currentLanguage: 'en' }),
}));

const getIntegration = vi.fn();
const upsertIntegration = vi.fn();

vi.mock('@/services/agents/integrationService', () => ({
  default: {
    getIntegration: (...args: unknown[]) => getIntegration(...args),
    upsertIntegration: (...args: unknown[]) => upsertIntegration(...args),
  },
}));

const listIntegrationCredentials = vi.fn();

vi.mock('@/services/agents', () => ({
  listIntegrationCredentials: (...args: unknown[]) => listIntegrationCredentials(...args),
}));

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  listIntegrationCredentials.mockResolvedValue([]);
  getIntegration.mockResolvedValue({ config: {} });
  upsertIntegration.mockResolvedValue({});
});

function renderConfig(data: ExternalAgentConfigData, onChange = vi.fn()) {
  const onValidationChange = vi.fn();
  const utils = render(
    <ExternalAgentConfig
      mode="edit"
      agentId="agent-1"
      data={data}
      onChange={onChange}
      onValidationChange={onValidationChange}
    />,
  );
  return { ...utils, onChange, onValidationChange };
}

describe('ExternalAgentConfig — vault credential selector (2.3 AC7)', () => {
  it('renders the selector for providers with a credential', async () => {
    renderConfig({ provider: 'dify', dify_apiUrl: 'https://api.dify.ai/v1', dify_apiKey: 'app-x' });

    await waitFor(() =>
      expect(document.getElementById('external-agent-credential')).not.toBeNull(),
    );
  });

  it('never offers the selector for typebot, which has no credential (AC6, negative proof)', async () => {
    renderConfig({ provider: 'typebot', typebot_url: 'https://t.io', typebot_typebot: 'bot' });

    await screen.findByText('edit.configuration.sections.externalIntegration.providerConfig.title');
    expect(document.getElementById('external-agent-credential')).toBeNull();
    // No vault fetch either: the hook stays disabled for typebot.
    expect(listIntegrationCredentials).not.toHaveBeenCalled();
  });

  it('saves credential_id ALONGSIDE the inline key (fallback preserved, negative proof)', async () => {
    const user = userEvent.setup();
    renderConfig({
      provider: 'dify',
      credential_id: 'cred-dify',
      dify_apiUrl: 'https://api.dify.ai/v1',
      dify_apiKey: 'app-inline',
      dify_botType: 'chatBot',
    });

    await user.click(await screen.findByText('edit.configuration.sections.externalIntegration.providerConfig.save'));

    await waitFor(() => expect(upsertIntegration).toHaveBeenCalled());
    const [, payload] = upsertIntegration.mock.calls[0];
    expect(payload.config.credential_id).toBe('cred-dify');
    // The wholesale upsert replaces config: dropping the inline key here would
    // erase the stored fallback (the 1.6 data-loss path).
    expect(payload.config.apiKey).toBe('app-inline');
  });

  it('omits credential_id from the payload when none is chosen', async () => {
    const user = userEvent.setup();
    renderConfig({
      provider: 'dify',
      dify_apiUrl: 'https://api.dify.ai/v1',
      dify_apiKey: 'app-inline',
    });

    await user.click(await screen.findByText('edit.configuration.sections.externalIntegration.providerConfig.save'));

    await waitFor(() => expect(upsertIntegration).toHaveBeenCalled());
    const [, payload] = upsertIntegration.mock.calls[0];
    expect(payload.config).not.toHaveProperty('credential_id');
  });

  it('accepts a vault reference in place of the inline key on validation', async () => {
    const { onValidationChange } = renderConfig({
      provider: 'dify',
      credential_id: 'cred-dify',
      dify_apiUrl: 'https://api.dify.ai/v1',
      dify_apiKey: '',
    });

    await waitFor(() => expect(onValidationChange).toHaveBeenCalled());
    const lastCall = onValidationChange.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe(true);
  });

  it('still requires a secret when neither inline nor vault is set (negative proof)', async () => {
    const { onValidationChange } = renderConfig({
      provider: 'dify',
      dify_apiUrl: 'https://api.dify.ai/v1',
      dify_apiKey: '',
    });

    await waitFor(() => expect(onValidationChange).toHaveBeenCalled());
    const lastCall = onValidationChange.mock.calls.at(-1);
    expect(lastCall?.[0]).toBe(false);
  });

  it('loads the stored credential_id when editing', async () => {
    getIntegration.mockResolvedValue({
      config: { apiUrl: 'https://api.dify.ai/v1', apiKey: 'app-x', credential_id: 'cred-dify' },
    });
    const onChange = vi.fn();
    renderConfig({ provider: 'dify' }, onChange);

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls[0][0].credential_id).toBe('cred-dify');
  });
});
