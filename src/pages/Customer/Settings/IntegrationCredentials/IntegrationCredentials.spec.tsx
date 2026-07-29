import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IntegrationCredentials from './IntegrationCredentials';
import { maskKey } from '@/constants/aiProviders';
import type { IntegrationCredential } from '@/types/agents';

// EVO-2250 story 2.1: the vault page reads the new registry only, never
// returns the value to the browser, gates every action on
// ai_integration_credentials.* and only creates `static` credentials.
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

const listIntegrationCredentials = vi.fn();
const createIntegrationCredential = vi.fn();
const updateIntegrationCredential = vi.fn();
const deleteIntegrationCredential = vi.fn();

vi.mock('@/services/agents', () => ({
  listIntegrationCredentials: (...args: unknown[]) => listIntegrationCredentials(...args),
  createIntegrationCredential: (...args: unknown[]) => createIntegrationCredential(...args),
  updateIntegrationCredential: (...args: unknown[]) => updateIntegrationCredential(...args),
  deleteIntegrationCredential: (...args: unknown[]) => deleteIntegrationCredential(...args),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const DIFY_CREDENTIAL: IntegrationCredential = {
  id: 'cred-dify',
  name: 'Dify producao',
  provider: 'dify',
  kind: 'static',
  value_hint: '4f2a',
  value_format: 'scalar',
  scope: 'account',
  is_active: true,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
};

const ELEVENLABS_CREDENTIAL: IntegrationCredential = {
  id: 'cred-elevenlabs',
  name: 'ElevenLabs',
  provider: 'elevenlabs',
  kind: 'static',
  value_hint: '91bc',
  value_format: 'scalar',
  scope: 'account',
  is_active: false,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
};

const INSTALLATION_CREDENTIAL: IntegrationCredential = {
  id: 'cred-installation',
  name: 'n8n da casa',
  provider: 'n8n',
  kind: 'static',
  value_hint: 'aa11',
  value_format: 'composite',
  scope: 'installation',
  is_active: true,
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
};

const OAUTH_CREDENTIAL: IntegrationCredential = {
  id: 'cred-oauth-github',
  name: 'GitHub',
  provider: 'github',
  kind: 'oauth',
  scope: 'account',
  owner_store: 'agent_integration',
  owner_ref: 'integration-1',
  is_active: true,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
};

const ALL_PERMISSIONS = [
  'ai_integration_credentials.read',
  'ai_integration_credentials.create',
  'ai_integration_credentials.update',
  'ai_integration_credentials.delete',
];

const findAccountRow = () => screen.findByRole('cell', { name: 'Dify producao' });

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
  listIntegrationCredentials.mockResolvedValue([DIFY_CREDENTIAL, ELEVENLABS_CREDENTIAL]);
});

describe('IntegrationCredentials — listing (AC1, AC3)', () => {
  it('renders each credential with a masked hint, never the value itself', async () => {
    render(<IntegrationCredentials />);

    expect(await findAccountRow()).toBeInTheDocument();
    expect(screen.getByText(maskKey('4f2a'))).toBeInTheDocument();
    expect(screen.getByText(maskKey('91bc'))).toBeInTheDocument();
    // The new registry is the only source consulted.
    expect(listIntegrationCredentials).toHaveBeenCalledTimes(1);
  });

  it('shows provider, kind and state per credential', async () => {
    render(<IntegrationCredentials />);

    await findAccountRow();
    expect(screen.getByText('dify')).toBeInTheDocument();
    expect(screen.getAllByText('kind.static').length).toBe(2);
    expect(screen.getByText('status.active')).toBeInTheDocument();
    expect(screen.getByText('status.inactive')).toBeInTheDocument();
  });
});

describe('IntegrationCredentials — permission gates (AC7)', () => {
  it('refuses to render the list without ai_integration_credentials.read', async () => {
    granted = [];
    render(<IntegrationCredentials />);

    expect(await screen.findByText('messages.permissionDenied.read')).toBeInTheDocument();
    expect(listIntegrationCredentials).not.toHaveBeenCalled();
  });

  it('hides the create action without ai_integration_credentials.create', async () => {
    granted = ['ai_integration_credentials.read'];
    render(<IntegrationCredentials />);

    await findAccountRow();
    expect(screen.queryByText('actions.add')).not.toBeInTheDocument();
  });

  it('hides edit and delete without the matching grants', async () => {
    granted = ['ai_integration_credentials.read'];
    render(<IntegrationCredentials />);

    await findAccountRow();
    expect(screen.queryByLabelText('actions.edit')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('actions.delete')).not.toBeInTheDocument();
  });

  it('shows edit and delete when granted (positive control)', async () => {
    render(<IntegrationCredentials />);

    await findAccountRow();
    expect(screen.getAllByLabelText('actions.edit').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('actions.delete').length).toBeGreaterThan(0);
  });
});

describe('IntegrationCredentials — creating only static (AC2, AC4)', () => {
  it('sends kind static and never offers an oauth choice', async () => {
    const user = userEvent.setup();
    createIntegrationCredential.mockResolvedValue(DIFY_CREDENTIAL);
    render(<IntegrationCredentials />);

    await findAccountRow();
    await user.click(screen.getByText('actions.add'));

    // The form has no kind selector at all: oauth is opened by story 2.5.
    expect(screen.queryByText('kind.oauth')).not.toBeInTheDocument();

    await user.type(await screen.findByLabelText('form.labels.name'), 'Nova');
    await user.type(screen.getByLabelText('form.labels.provider'), 'dify');
    await user.type(screen.getByLabelText('form.labels.value'), 'app-secret-0001');
    await user.click(screen.getByText('actions.save'));

    await waitFor(() => expect(createIntegrationCredential).toHaveBeenCalled());
    const [payload] = createIntegrationCredential.mock.calls[0];
    expect(payload.kind).toBe('static');
    expect(payload.value).toBe('app-secret-0001');
  });

  it('blocks the save when name, provider or value is missing', async () => {
    const user = userEvent.setup();
    render(<IntegrationCredentials />);

    await findAccountRow();
    await user.click(screen.getByText('actions.add'));
    await user.type(await screen.findByLabelText('form.labels.name'), 'Sem valor');
    await user.click(screen.getByText('actions.save'));

    await waitFor(() => expect(createIntegrationCredential).not.toHaveBeenCalled());
  });
});

describe('IntegrationCredentials — editing without resending the value (AC3)', () => {
  it('omits value when the field is left empty', async () => {
    const user = userEvent.setup();
    updateIntegrationCredential.mockResolvedValue(DIFY_CREDENTIAL);
    render(<IntegrationCredentials />);

    await findAccountRow();
    await user.click(screen.getAllByLabelText('actions.edit')[0]);
    await user.click(await screen.findByText('actions.save'));

    await waitFor(() => expect(updateIntegrationCredential).toHaveBeenCalled());
    const [, payload] = updateIntegrationCredential.mock.calls[0];
    expect(payload).not.toHaveProperty('value');
    expect(payload.name).toBe('Dify producao');
  });

  it('sends the value when a new one is typed', async () => {
    const user = userEvent.setup();
    updateIntegrationCredential.mockResolvedValue(DIFY_CREDENTIAL);
    render(<IntegrationCredentials />);

    await findAccountRow();
    await user.click(screen.getAllByLabelText('actions.edit')[0]);
    await user.type(await screen.findByLabelText('form.labels.value'), 'rotated-0001');
    await user.click(screen.getByText('actions.save'));

    await waitFor(() => expect(updateIntegrationCredential).toHaveBeenCalled());
    const [, payload] = updateIntegrationCredential.mock.calls[0];
    expect(payload.value).toBe('rotated-0001');
  });
});

describe('IntegrationCredentials — oauth rows stay out of the static tables (AC4)', () => {
  it('keeps an oauth credential off the account and installation sections', async () => {
    listIntegrationCredentials.mockResolvedValue([DIFY_CREDENTIAL, OAUTH_CREDENTIAL]);
    render(<IntegrationCredentials />);

    await findAccountRow();
    // The oauth reference is not a static credential: it belongs to the
    // connections section, hidden until story 2.5.
    expect(screen.queryByRole('cell', { name: 'GitHub' })).not.toBeInTheDocument();
  });
});

// EVO-2250 story 2.2: the installation link of the chain. Writing at that
// level is gated on installation_configs.manage, NOT on the update grant of
// the resource — the negative proofs below fail if the component ever swaps
// canManageInstallation for canUpdate.
describe('IntegrationCredentials — installation scope (2.2 AC8)', () => {
  const findInstallationRow = () => screen.findByRole('cell', { name: 'n8n da casa' });

  beforeEach(() => {
    listIntegrationCredentials.mockResolvedValue([DIFY_CREDENTIAL, INSTALLATION_CREDENTIAL]);
  });

  it('renders installation credentials read-only WITH the full resource grants (negative proof)', async () => {
    // Every ai_integration_credentials.* grant, including update, but no
    // installation_configs.manage: a gate wired to canUpdate would expose the
    // installation edit controls here and fail these assertions.
    granted = [...ALL_PERMISSIONS];
    render(<IntegrationCredentials />);

    await findInstallationRow();
    expect(screen.getByText('inheritedReadOnly')).toBeInTheDocument();
    // Exactly one edit control: the account row's. The installation row has none.
    expect(screen.getAllByLabelText('actions.edit')).toHaveLength(1);
    expect(screen.getAllByLabelText('actions.delete')).toHaveLength(1);
  });

  it('hides the installation add button without installation_configs.manage (negative proof)', async () => {
    granted = [...ALL_PERMISSIONS];
    render(<IntegrationCredentials />);

    await findInstallationRow();
    // Only the page-level (account) add button renders.
    expect(screen.getAllByText('actions.add')).toHaveLength(1);
  });

  it('exposes write controls on the installation row when granted (positive control)', async () => {
    granted = [...ALL_PERMISSIONS, 'installation_configs.manage'];
    render(<IntegrationCredentials />);

    await findInstallationRow();
    expect(screen.queryByText('inheritedReadOnly')).not.toBeInTheDocument();
    expect(screen.getAllByLabelText('actions.edit')).toHaveLength(2);
    // The section header carries its own add button.
    expect(screen.getAllByText('actions.add')).toHaveLength(2);
  });

  it('sends the scope when updating an installation credential', async () => {
    const user = userEvent.setup();
    granted = [...ALL_PERMISSIONS, 'installation_configs.manage'];
    updateIntegrationCredential.mockResolvedValue(INSTALLATION_CREDENTIAL);
    render(<IntegrationCredentials />);

    await findInstallationRow();
    await user.click(screen.getAllByLabelText('actions.edit')[1]);
    await user.click(await screen.findByText('actions.save'));

    await waitFor(() => expect(updateIntegrationCredential).toHaveBeenCalled());
    const [id, payload] = updateIntegrationCredential.mock.calls[0];
    expect(id).toBe('cred-installation');
    expect(payload.scope).toBe('installation');
  });

  it('shows the empty hint when the installation has nothing', async () => {
    listIntegrationCredentials.mockResolvedValue([DIFY_CREDENTIAL]);
    render(<IntegrationCredentials />);

    await findAccountRow();
    expect(screen.getByText('installationEmpty')).toBeInTheDocument();
  });
});

// The panel answers "which credential is in effect" and is born empty: the
// consumers plug in with stories 2.3/2.4 (2.2 AC9).
describe('IntegrationCredentials — in-use panel (2.2 AC9)', () => {
  it('renders the panel above the lists with the empty explanation', async () => {
    render(<IntegrationCredentials />);

    await findAccountRow();
    const panel = screen.getByLabelText('inUse.title');
    expect(panel).toHaveTextContent('inUse.empty');
  });
});

describe('IntegrationCredentials — deleting (AC6)', () => {
  it('warns about consumers referencing the credential before confirming', async () => {
    const user = userEvent.setup();
    listIntegrationCredentials.mockResolvedValue([
      { ...DIFY_CREDENTIAL, referenced_by: ['Agente Dify', 'Bot vendas'] },
    ]);
    render(<IntegrationCredentials />);

    await findAccountRow();
    await user.click(screen.getAllByLabelText('actions.delete')[0]);

    expect(await screen.findByRole('alert')).toHaveTextContent('deleteDialog.inUseWarning');
    expect(deleteIntegrationCredential).not.toHaveBeenCalled();
  });

  it('deletes only after confirmation', async () => {
    const user = userEvent.setup();
    deleteIntegrationCredential.mockResolvedValue({ message: 'ok' });
    render(<IntegrationCredentials />);

    await findAccountRow();
    await user.click(screen.getAllByLabelText('actions.delete')[0]);
    await user.click(await screen.findByText('deleteDialog.confirm'));

    await waitFor(() => expect(deleteIntegrationCredential).toHaveBeenCalledWith('cred-dify'));
  });
});
