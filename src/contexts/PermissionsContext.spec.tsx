import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
    getUserPermissions: () => Promise.resolve([]),
    getAccountPermissions: () => mockAccountPermissions(),
  },
}));

const Probe: React.FC = () => {
  const { can, isReady } = usePermissions();
  if (!isReady) return <span>loading</span>;
  return (
    <>
      <span data-testid="contacts-read">{String(can('contacts', 'read'))}</span>
      <span data-testid="installation-manage">{String(can('installation_configs', 'manage'))}</span>
    </>
  );
};

async function renderWith(role: string, granted: string[]) {
  mockUser.mockReturnValue({ id: 'user-1', name: 'Someone', role });
  mockAccountPermissions.mockResolvedValue(granted);

  render(
    <PermissionsProvider>
      <Probe />
    </PermissionsProvider>,
  );

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
