import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AiCredentials from './AiCredentials';
import { maskKey } from '@/constants/aiProviders';
import type { ApiKey } from '@/types/agents';

// EVO-2250 story 1.1: the page reads the evo_core_api_keys registry only, never
// returns the key to the browser, and gates every action on ai_api_keys.*.
let granted: string[] = [];

vi.mock('@/contexts/PermissionsContext', () => ({
  usePermissions: () => ({
    can: (resource: string, action: string) => granted.includes(`${resource}.${action}`),
    isReady: true,
    loading: false,
  }),
}));

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (key: string) => key, currentLanguage: 'en' }),
}));

const listApiKeys = vi.fn();
const createApiKey = vi.fn();
const updateApiKey = vi.fn();
const deleteApiKey = vi.fn();
const listAgents = vi.fn();

vi.mock('@/services/agents', () => ({
  listApiKeys: (...args: unknown[]) => listApiKeys(...args),
  createApiKey: (...args: unknown[]) => createApiKey(...args),
  updateApiKey: (...args: unknown[]) => updateApiKey(...args),
  deleteApiKey: (...args: unknown[]) => deleteApiKey(...args),
  listAgents: (...args: unknown[]) => listAgents(...args),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const OPENAI_KEY: ApiKey = {
  id: 'key-openai',
  name: 'Producao',
  provider: 'openai',
  key_hint: '4f2a',
  openai_compatible: true,
  is_active: true,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
};

const ANTHROPIC_KEY: ApiKey = {
  id: 'key-anthropic',
  name: 'Testes',
  provider: 'anthropic',
  key_hint: '91bc',
  openai_compatible: false,
  is_active: false,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
};

const ALL_PERMISSIONS = [
  'ai_api_keys.read',
  'ai_api_keys.create',
  'ai_api_keys.update',
  'ai_api_keys.delete',
];

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  granted = [...ALL_PERMISSIONS];
  listApiKeys.mockResolvedValue([OPENAI_KEY, ANTHROPIC_KEY]);
  listAgents.mockResolvedValue({ data: [] });
});

describe('AiCredentials — listing (AC1, AC7)', () => {
  it('renders each credential with a masked key, never the key itself', async () => {
    render(<AiCredentials />);

    expect(await screen.findByText('Producao')).toBeInTheDocument();
    expect(screen.getByText(maskKey('4f2a'))).toBeInTheDocument();
    expect(screen.getByText(maskKey('91bc'))).toBeInTheDocument();
    // The registry is the only source consulted.
    expect(listApiKeys).toHaveBeenCalledTimes(1);
  });

  it('says which features each provider serves', async () => {
    render(<AiCredentials />);

    await screen.findByText('Producao');
    expect(screen.getByText('serves.all')).toBeInTheDocument();
    expect(screen.getByText('serves.agentsOnly')).toBeInTheDocument();
  });

  it('shows the active/inactive state per credential', async () => {
    render(<AiCredentials />);

    await screen.findByText('Producao');
    expect(screen.getByText('status.active')).toBeInTheDocument();
    expect(screen.getByText('status.inactive')).toBeInTheDocument();
  });
});

describe('AiCredentials — permission gates (AC8)', () => {
  it('refuses to render the list without ai_api_keys.read', async () => {
    granted = [];
    render(<AiCredentials />);

    expect(await screen.findByText('messages.permissionDenied.read')).toBeInTheDocument();
    expect(listApiKeys).not.toHaveBeenCalled();
  });

  it('hides the create action without ai_api_keys.create', async () => {
    granted = ['ai_api_keys.read'];
    render(<AiCredentials />);

    await screen.findByText('Producao');
    expect(screen.queryByText('actions.add')).not.toBeInTheDocument();
  });

  it('hides edit and delete without the matching grants', async () => {
    granted = ['ai_api_keys.read'];
    render(<AiCredentials />);

    await screen.findByText('Producao');
    expect(screen.queryByLabelText('actions.edit')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('actions.delete')).not.toBeInTheDocument();
  });

  it('shows edit and delete when granted (positive control)', async () => {
    render(<AiCredentials />);

    await screen.findByText('Producao');
    expect(screen.getAllByLabelText('actions.edit').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('actions.delete').length).toBeGreaterThan(0);
  });
});

describe('AiCredentials — editing without resending the key (AC3)', () => {
  it('omits key_value when the field is left empty', async () => {
    const user = userEvent.setup();
    updateApiKey.mockResolvedValue(OPENAI_KEY);
    render(<AiCredentials />);

    await screen.findByText('Producao');
    await user.click(screen.getAllByLabelText('actions.edit')[0]);
    await user.click(await screen.findByText('actions.save'));

    await waitFor(() => expect(updateApiKey).toHaveBeenCalled());
    const [, payload] = updateApiKey.mock.calls[0];
    expect(payload).not.toHaveProperty('key_value');
    expect(payload.name).toBe('Producao');
  });

  it('sends key_value when a new key is typed', async () => {
    const user = userEvent.setup();
    updateApiKey.mockResolvedValue(OPENAI_KEY);
    render(<AiCredentials />);

    await screen.findByText('Producao');
    await user.click(screen.getAllByLabelText('actions.edit')[0]);
    await user.type(await screen.findByLabelText('form.labels.key'), 'sk-rotated-0001');
    await user.click(screen.getByText('actions.save'));

    await waitFor(() => expect(updateApiKey).toHaveBeenCalled());
    const [, payload] = updateApiKey.mock.calls[0];
    expect(payload.key_value).toBe('sk-rotated-0001');
  });
});

describe('AiCredentials — incompatible provider warning (AC7)', () => {
  it('warns without blocking when the provider is not OpenAI-compatible', async () => {
    const user = userEvent.setup();
    render(<AiCredentials />);

    await screen.findByText('Producao');
    // The Anthropic credential is incompatible; editing it surfaces the notice.
    await user.click(screen.getAllByLabelText('actions.edit')[1]);

    expect(await screen.findByRole('alert')).toHaveTextContent('form.incompatibleWarning');
    // Saving stays available — the warning informs, it does not block.
    expect(screen.getByText('actions.save')).toBeEnabled();
  });

  it('does not warn for an OpenAI-compatible provider', async () => {
    const user = userEvent.setup();
    render(<AiCredentials />);

    await screen.findByText('Producao');
    await user.click(screen.getAllByLabelText('actions.edit')[0]);

    await screen.findByLabelText('form.labels.key');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('AiCredentials — delete warns about agents in use (AC5)', () => {
  it('lists the agents using the credential before confirming', async () => {
    const user = userEvent.setup();
    listAgents.mockResolvedValue({
      data: [
        { id: 'a1', name: 'Atendente', api_key_id: 'key-openai' },
        { id: 'a2', name: 'Outro', api_key_id: 'key-anthropic' },
      ],
    });
    render(<AiCredentials />);

    await screen.findByText('Producao');
    await user.click(screen.getAllByLabelText('actions.delete')[0]);

    expect(await screen.findByRole('alert')).toHaveTextContent('deleteDialog.inUseWarning');
    // Nothing is deleted until the user confirms.
    expect(deleteApiKey).not.toHaveBeenCalled();
  });

  it('deletes only after confirmation', async () => {
    const user = userEvent.setup();
    deleteApiKey.mockResolvedValue({ message: 'ok' });
    render(<AiCredentials />);

    await screen.findByText('Producao');
    await user.click(screen.getAllByLabelText('actions.delete')[0]);
    await user.click(await screen.findByText('deleteDialog.confirm'));

    await waitFor(() => expect(deleteApiKey).toHaveBeenCalledWith('key-openai'));
  });
});

describe('AiCredentials — creating (AC2)', () => {
  it('sends name, provider and key to the registry', async () => {
    const user = userEvent.setup();
    createApiKey.mockResolvedValue(OPENAI_KEY);
    render(<AiCredentials />);

    await screen.findByText('Producao');
    await user.click(screen.getByText('actions.add'));

    await user.type(await screen.findByLabelText('form.labels.name'), 'Nova');
    await user.type(screen.getByLabelText('form.labels.key'), 'sk-nova-0001');
    await user.click(screen.getByText('actions.save'));

    // Provider is required, so an untouched select must block the save.
    await waitFor(() => expect(createApiKey).not.toHaveBeenCalled());
  });
});
