import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { permissionsService } from './permissions';
import { apiAuth } from '@/services/core';

// CRM-164. The context tests mock this service away, so without these examples
// reverting the two `throw error` lines below back to `return []` restores the
// original bug with every other test still green. The conditional is the whole
// point: a failure serves the stale cache when there is one, and only fails
// when there is nothing to serve.

vi.mock('@/services/core', () => ({
  apiAuth: { get: vi.fn() },
}));

const get = vi.mocked(apiAuth.get);

describe('permissionsService — a failed fetch fails loudly (CRM-164)', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;
  let consoleWarn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    permissionsService.clearCache();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
    consoleWarn.mockRestore();
  });

  it('rejects instead of resolving to [] when the user fetch fails with no cache', async () => {
    get.mockRejectedValue(new Error('network down'));

    await expect(permissionsService.getUserPermissions()).rejects.toThrow('network down');
  });

  it('rejects instead of resolving to [] when the account fetch fails with no cache', async () => {
    get.mockRejectedValue(new Error('network down'));

    await expect(permissionsService.getAccountPermissions()).rejects.toThrow('network down');
  });

  it('serves the stale user cache instead of failing when a later fetch breaks', async () => {
    get.mockResolvedValueOnce({ data: { data: { permissions: ['contacts.read'] } } });
    await expect(permissionsService.getUserPermissions()).resolves.toEqual(['contacts.read']);

    get.mockRejectedValue(new Error('network down'));
    await expect(permissionsService.getUserPermissions(true)).resolves.toEqual(['contacts.read']);
  });

  it('serves the stale account cache instead of failing when a later fetch breaks', async () => {
    get.mockResolvedValueOnce({ data: { data: { permissions: ['contacts.read'] } } });
    await expect(permissionsService.getAccountPermissions()).resolves.toEqual(['contacts.read']);

    get.mockRejectedValue(new Error('network down'));
    await expect(permissionsService.getAccountPermissions(true)).resolves.toEqual([
      'contacts.read',
    ]);
  });

  it('does not strand a rejected promise in the dedup slot', async () => {
    get.mockRejectedValueOnce(new Error('network down'));
    await expect(permissionsService.getUserPermissions()).rejects.toThrow('network down');

    // A retry must issue a fresh request rather than replay the failed one.
    get.mockResolvedValueOnce({ data: { data: { permissions: ['contacts.read'] } } });
    await expect(permissionsService.getUserPermissions()).resolves.toEqual(['contacts.read']);
    expect(get).toHaveBeenCalledTimes(2);
  });
});
