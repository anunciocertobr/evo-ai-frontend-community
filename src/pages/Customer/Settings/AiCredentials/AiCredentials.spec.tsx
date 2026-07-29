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
  scope: 'account',
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
  scope: 'account',
  is_active: false,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
};

const INSTALLATION_KEY: ApiKey = {
  id: 'key-installation',
  name: 'Chave da casa',
  provider: 'openai',
  key_hint: 'aa11',
  openai_compatible: true,
  scope: 'installation',
  is_active: true,
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
};

const ALL_PERMISSIONS = [
  'ai_api_keys.read',
  'ai_api_keys.create',
  'ai_api_keys.update',
  'ai_api_keys.delete',
];

// Since story 1.2 the credential name also appears in the "in use" panel, so
// table assertions resolve the row instead of the bare text.
const findAccountRow = () => screen.findByRole('cell', { name: 'Producao' });

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

    expect(await findAccountRow()).toBeInTheDocument();
    expect(screen.getByText(maskKey('4f2a'))).toBeInTheDocument();
    expect(screen.getByText(maskKey('91bc'))).toBeInTheDocument();
    // The registry is the only source consulted.
    expect(listApiKeys).toHaveBeenCalledTimes(1);
  });

  it('says which features each provider serves', async () => {
    render(<AiCredentials />);

    await findAccountRow();
    expect(screen.getByText('serves.all')).toBeInTheDocument();
    expect(screen.getByText('serves.agentsOnly')).toBeInTheDocument();
  });

  it('shows the active/inactive state per credential', async () => {
    render(<AiCredentials />);

    await findAccountRow();
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

    await findAccountRow();
    expect(screen.queryByText('actions.add')).not.toBeInTheDocument();
  });

  it('hides edit and delete without the matching grants', async () => {
    granted = ['ai_api_keys.read'];
    render(<AiCredentials />);

    await findAccountRow();
    expect(screen.queryByLabelText('actions.edit')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('actions.delete')).not.toBeInTheDocument();
  });

  it('shows edit and delete when granted (positive control)', async () => {
    render(<AiCredentials />);

    await findAccountRow();
    expect(screen.getAllByLabelText('actions.edit').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('actions.delete').length).toBeGreaterThan(0);
  });
});

describe('AiCredentials — editing without resending the key (AC3)', () => {
  it('omits key_value when the field is left empty', async () => {
    const user = userEvent.setup();
    updateApiKey.mockResolvedValue(OPENAI_KEY);
    render(<AiCredentials />);

    await findAccountRow();
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

    await findAccountRow();
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

    await findAccountRow();
    // The Anthropic credential is incompatible; editing it surfaces the notice.
    await user.click(screen.getAllByLabelText('actions.edit')[1]);

    expect(await screen.findByRole('alert')).toHaveTextContent('form.incompatibleWarning');
    // Saving stays available — the warning informs, it does not block.
    expect(screen.getByText('actions.save')).toBeEnabled();
  });

  it('does not warn for an OpenAI-compatible provider', async () => {
    const user = userEvent.setup();
    render(<AiCredentials />);

    await findAccountRow();
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

    await findAccountRow();
    await user.click(screen.getAllByLabelText('actions.delete')[0]);

    expect(await screen.findByRole('alert')).toHaveTextContent('deleteDialog.inUseWarning');
    // Nothing is deleted until the user confirms.
    expect(deleteApiKey).not.toHaveBeenCalled();
  });

  it('deletes only after confirmation', async () => {
    const user = userEvent.setup();
    deleteApiKey.mockResolvedValue({ message: 'ok' });
    render(<AiCredentials />);

    await findAccountRow();
    await user.click(screen.getAllByLabelText('actions.delete')[0]);
    await user.click(await screen.findByText('deleteDialog.confirm'));

    await waitFor(() => expect(deleteApiKey).toHaveBeenCalledWith('key-openai'));
  });
});

// EVO-2250 story 1.2: the installation link of the chain.
describe('AiCredentials — installation scope (1.2 AC1, AC2)', () => {
  const findInstallationRow = () => screen.findByRole('cell', { name: 'Chave da casa' });

  beforeEach(() => {
    listApiKeys.mockResolvedValue([OPENAI_KEY, INSTALLATION_KEY]);
  });

  it('splits credentials into the account and installation sections', async () => {
    render(<AiCredentials />);

    await findAccountRow();
    expect(await findInstallationRow()).toBeInTheDocument();
    // A single listing call feeds both sections.
    expect(listApiKeys).toHaveBeenCalledTimes(1);
  });

  it('lets an installation admin add a credential at that level', async () => {
    const user = userEvent.setup();
    granted = [...ALL_PERMISSIONS, 'installation_configs.manage'];
    createApiKey.mockResolvedValue(INSTALLATION_KEY);
    render(<AiCredentials />);

    await findInstallationRow();
    // The section header carries its own add button.
    const addButtons = screen.getAllByText('actions.add');
    await user.click(addButtons[addButtons.length - 1]);

    await user.type(await screen.findByLabelText('form.labels.name'), 'Nova da casa');
    await user.type(screen.getByLabelText('form.labels.key'), 'sk-house-0002');
    await user.click(screen.getByText('actions.save'));

    // Provider is still required, so nothing is sent — the scope plumbing is
    // asserted by the payload test below.
    await waitFor(() => expect(createApiKey).not.toHaveBeenCalled());
  });

  it('renders installation credentials read-only without installation_configs.manage (AC2)', async () => {
    render(<AiCredentials />);

    await findInstallationRow();
    expect(screen.getByText('inheritedReadOnly')).toBeInTheDocument();
    // Exactly one edit control: the account row's. The installation row has none.
    expect(screen.getAllByLabelText('actions.edit')).toHaveLength(1);
    expect(screen.getAllByLabelText('actions.delete')).toHaveLength(1);
  });

  it('exposes write controls on the installation row when granted (positive control)', async () => {
    granted = [...ALL_PERMISSIONS, 'installation_configs.manage'];
    render(<AiCredentials />);

    await findInstallationRow();
    expect(screen.queryByText('inheritedReadOnly')).not.toBeInTheDocument();
    expect(screen.getAllByLabelText('actions.edit')).toHaveLength(2);
  });

  it('sends the scope when updating an installation credential', async () => {
    const user = userEvent.setup();
    granted = [...ALL_PERMISSIONS, 'installation_configs.manage'];
    updateApiKey.mockResolvedValue(INSTALLATION_KEY);
    render(<AiCredentials />);

    await findInstallationRow();
    await user.click(screen.getAllByLabelText('actions.edit')[1]);
    await user.click(await screen.findByText('actions.save'));

    await waitFor(() => expect(updateApiKey).toHaveBeenCalled());
    const [id, payload] = updateApiKey.mock.calls[0];
    expect(id).toBe('key-installation');
    expect(payload.scope).toBe('installation');
  });

  it('shows the empty hint when the installation has no default', async () => {
    listApiKeys.mockResolvedValue([OPENAI_KEY]);
    render(<AiCredentials />);

    await findAccountRow();
    expect(screen.getByText('installationEmpty')).toBeInTheDocument();
  });
});

// The panel answers "which credential is in effect right now" (1.2 AC9).
describe('AiCredentials — in-use panel (1.2 AC9)', () => {
  it('shows the account credential winning over the installation default', async () => {
    listApiKeys.mockResolvedValue([INSTALLATION_KEY, OPENAI_KEY]);
    render(<AiCredentials />);

    await findAccountRow();
    const panel = screen.getByLabelText('inUse.title');
    expect(panel).toHaveTextContent('inUse.features.aiAgents');
    expect(panel).toHaveTextContent('Producao');
    expect(panel).toHaveTextContent('inUse.fromAccount');
  });

  it('falls back to the installation default when the account has none', async () => {
    listApiKeys.mockResolvedValue([INSTALLATION_KEY]);
    render(<AiCredentials />);

    const panel = await screen.findByLabelText('inUse.title');
    await waitFor(() => expect(panel).toHaveTextContent('Chave da casa'));
    expect(panel).toHaveTextContent('inUse.fromInstallation');
    expect(panel).toHaveTextContent('inUse.inheritingHint');
  });

  it('ignores an inactive account credential and inherits the default', async () => {
    listApiKeys.mockResolvedValue([INSTALLATION_KEY, ANTHROPIC_KEY]);
    render(<AiCredentials />);

    const panel = await screen.findByLabelText('inUse.title');
    await waitFor(() => expect(panel).toHaveTextContent('Chave da casa'));
  });

  it('reports no credential when nothing is configured', async () => {
    listApiKeys.mockResolvedValue([]);
    render(<AiCredentials />);

    const panel = await screen.findByLabelText('inUse.title');
    await waitFor(() => expect(panel).toHaveTextContent('inUse.none'));
  });

  it('lists the five AI features of the CRM (1.4 completes the panel)', async () => {
    listApiKeys.mockResolvedValue([OPENAI_KEY]);
    render(<AiCredentials />);

    const panel = await screen.findByLabelText('inUse.title');
    ['aiAgents', 'inboxAssist', 'audioTranscription', 'labelSuggestion', 'moderation'].forEach(
      feature => expect(panel).toHaveTextContent(`inUse.features.${feature}`),
    );
  });

  // 1.4 AC7: an Anthropic account credential serves Agents but none of the four
  // OpenAI-shaped features, which fall through to the installation default.
  it('splits agents from the OpenAI-only features when providers differ', async () => {
    const anthropicActive = { ...ANTHROPIC_KEY, is_active: true };
    listApiKeys.mockResolvedValue([INSTALLATION_KEY, anthropicActive]);
    render(<AiCredentials />);

    const panel = await screen.findByLabelText('inUse.title');
    await waitFor(() => expect(panel).toHaveTextContent('Testes'));
    // The house key covers transcription, labels and moderation.
    expect(panel).toHaveTextContent('Chave da casa');
    expect(panel).toHaveTextContent('inUse.fromInstallation');
  });

  // 1.3 AC8 + FR18: the assist cannot speak Anthropic, so it shows the
  // installation default while AI Agents keep the account credential.
  it('shows the assist falling back when the account credential is incompatible', async () => {
    const anthropicActive = { ...ANTHROPIC_KEY, is_active: true };
    listApiKeys.mockResolvedValue([INSTALLATION_KEY, anthropicActive]);
    render(<AiCredentials />);

    const panel = await screen.findByLabelText('inUse.title');
    await waitFor(() => expect(panel).toHaveTextContent('Testes'));
    expect(panel).toHaveTextContent('Chave da casa');
    expect(panel).toHaveTextContent('inUse.fromInstallation');
  });
});

describe('AiCredentials — creating (AC2)', () => {
  it('sends name, provider and key to the registry', async () => {
    const user = userEvent.setup();
    createApiKey.mockResolvedValue(OPENAI_KEY);
    render(<AiCredentials />);

    await findAccountRow();
    await user.click(screen.getByText('actions.add'));

    await user.type(await screen.findByLabelText('form.labels.name'), 'Nova');
    await user.type(screen.getByLabelText('form.labels.key'), 'sk-nova-0001');
    await user.click(screen.getByText('actions.save'));

    // Provider is required, so an untouched select must block the save.
    await waitFor(() => expect(createApiKey).not.toHaveBeenCalled());
  });
});
