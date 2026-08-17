import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { PermissionsProvider, usePermissions } from './PermissionsContext';

// Data-driven guard. The backend has no RBAC bypass for the installation owner
// (the resource gate and /permissions are row-based), so `can()` must answer
// strictly from the granted permission list. A role short-circuit here — e.g.
// "super_admin sees everything" — would render controls the API then 403s, and
// would hide the seed drift the backend guard exists to surface. These examples
// pin that behaviour: the exact same permission list must produce the exact
// same answers no matter which role the user carries.

const mockUser = vi.fn();

vi.mock('./AuthContext', () => ({
  useAuth: () => ({ user: mockUser() }),
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: { getState: () => ({ isLoggedIn: true }) },
}));

const mockAccountPermissions = vi.fn<[], Promise<string[]>>();
const mockUserPermissions = vi.fn<[], Promise<string[]>>();

vi.mock('@/services/permissions', () => ({
  permissionsService: {
    getResourceActions: () =>
      Promise.resolve({
        data: {
          all_permissions: [
            { key: 'contacts.read', display_name: 'Contacts - Read' },
            { key: 'installation_configs.manage', display_name: 'Installation Configs - Manage' },
          ],
        },
      }),
    getUserPermissions: () => mockUserPermissions(),
    getAccountPermissions: () => mockAccountPermissions(),
  },
}));

const Probe: React.FC = () => {
  const { can, isReady, loadFailed, refreshPermissions } = usePermissions();
  return (
    <>
      <span data-testid="ready">{String(isReady)}</span>
      <span data-testid="load-failed">{String(loadFailed)}</span>
      <button
        onClick={() => {
          void refreshPermissions();
        }}
      >
        retry
      </button>
      {isReady ? (
        <>
          <span data-testid="contacts-read">{String(can('contacts', 'read'))}</span>
          <span data-testid="installation-manage">{String(can('installation_configs', 'manage'))}</span>
        </>
      ) : (
        <span>loading</span>
      )}
    </>
  );
};

function renderProbe(role = 'agent') {
  mockUser.mockReturnValue({ id: 'user-1', name: 'Someone', role });
  render(
    <PermissionsProvider>
      <Probe />
    </PermissionsProvider>,
  );
}

async function renderWith(role: string, granted: string[]) {
  mockUserPermissions.mockResolvedValue([]);
  mockAccountPermissions.mockResolvedValue(granted);
  renderProbe(role);

  await waitFor(() => expect(screen.queryByText('loading')).toBeNull());
}

describe('PermissionsContext — can() stays data-driven (no role short-circuit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('denies a permission the user was not granted, even for super_admin', async () => {
    await renderWith('super_admin', ['contacts.read']);

    expect(screen.getByTestId('contacts-read').textContent).toBe('true');
    // The seed grants this key to super_admin; a stale installation may not
    // have it yet. The UI must reflect the grants, not the role name.
    expect(screen.getByTestId('installation-manage').textContent).toBe('false');
  });

  it('grants a permission the user holds, regardless of role', async () => {
    await renderWith('agent', ['contacts.read', 'installation_configs.manage']);

    expect(screen.getByTestId('contacts-read').textContent).toBe('true');
    expect(screen.getByTestId('installation-manage').textContent).toBe('true');
  });

  it('denies everything when the permission list is empty, even for super_admin', async () => {
    await renderWith('super_admin', []);

    expect(screen.getByTestId('contacts-read').textContent).toBe('false');
    expect(screen.getByTestId('installation-manage').textContent).toBe('false');
  });
});

// CRM-164. The service used to swallow a failed fetch and return [], so the
// context reported `isReady` with an empty list and every `can()` answered
// false — a load failure reaching the user as "you don't have permission".
// The two windows the bug was reported through (reloading with a conversation
// open, and switching accounts — which the shell serves with a full
// window.location.reload) are the same boot path, so they are the same
// examples: a fetch that throws must leave the context not-ready and flagged.
describe('PermissionsContext — a failed load is not a denial (CRM-164)', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserPermissions.mockResolvedValue([]);
    mockAccountPermissions.mockResolvedValue([]);
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('stays not-ready and reports loadFailed when the account fetch throws', async () => {
    mockAccountPermissions.mockRejectedValue(new Error('network down'));
    renderProbe();

    await waitFor(() => expect(screen.getByTestId('load-failed').textContent).toBe('true'));
    expect(screen.getByTestId('ready').textContent).toBe('false');
    // Nothing evaluated `can()`, so no screen could have rendered a denial.
    expect(screen.queryByTestId('contacts-read')).toBeNull();
  });

  it('stays not-ready and reports loadFailed when the user fetch throws', async () => {
    mockUserPermissions.mockRejectedValue(new Error('network down'));
    renderProbe();

    await waitFor(() => expect(screen.getByTestId('load-failed').textContent).toBe('true'));
    expect(screen.getByTestId('ready').textContent).toBe('false');
  });

  it('recovers on retry: refreshPermissions clears the failure and grants access', async () => {
    mockAccountPermissions.mockRejectedValueOnce(new Error('network down'));
    mockAccountPermissions.mockResolvedValue(['contacts.read']);
    renderProbe();

    await waitFor(() => expect(screen.getByTestId('load-failed').textContent).toBe('true'));
    // Pinned so the recovery below cannot be credited to an effect refiring on
    // its own — the click has to be what refetches.
    const callsBeforeRetry = mockAccountPermissions.mock.calls.length;

    fireEvent.click(screen.getByText('retry'));

    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'));
    expect(screen.getByTestId('load-failed').textContent).toBe('false');
    expect(screen.getByTestId('contacts-read').textContent).toBe('true');
    expect(mockAccountPermissions.mock.calls.length).toBeGreaterThan(callsBeforeRetry);
  });

  it('treats a successfully empty list as a real denial, not a failure', async () => {
    renderProbe();

    await waitFor(() => expect(screen.getByTestId('ready').textContent).toBe('true'));
    expect(screen.getByTestId('load-failed').textContent).toBe('false');
    expect(screen.getByTestId('contacts-read').textContent).toBe('false');
  });
});
