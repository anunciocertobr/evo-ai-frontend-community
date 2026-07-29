import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  isAuthHeaderName,
  mergeRetiredHeaders,
  splitAuthHeaders,
  useVaultMigrationState,
} from './vaultRetirement';

// EVO-2250 story 2.7: the retirement guard and the round-trip guarantee.

const getIntegrationVaultMigrationState = vi.fn();

vi.mock('@/services/agents', () => ({
  getIntegrationVaultMigrationState: (...args: unknown[]) =>
    getIntegrationVaultMigrationState(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useVaultMigrationState — guard fails closed towards keeping the inline fields', () => {
  it('reports retired consumers as the backend states them', async () => {
    getIntegrationVaultMigrationState.mockResolvedValue({ retired: { custom_tools: true } });
    const { result } = renderHook(() => useVaultMigrationState());

    await waitFor(() => expect(result.current.retired.custom_tools).toBe(true));
    expect(result.current.retired.custom_mcp_servers).toBeUndefined();
  });

  it('reads a guard failure as NOT retired (nothing is removed on a broken installation)', async () => {
    getIntegrationVaultMigrationState.mockRejectedValue(new Error('503'));
    const { result } = renderHook(() => useVaultMigrationState());

    await waitFor(() => expect(getIntegrationVaultMigrationState).toHaveBeenCalled());
    expect(result.current.retired).toEqual({});
  });

  it('does not consult the guard while disabled', () => {
    renderHook(() => useVaultMigrationState(false));
    expect(getIntegrationVaultMigrationState).not.toHaveBeenCalled();
  });
});

describe('splitAuthHeaders — the conservative heuristic of story 2.6', () => {
  it('recognizes auth headers in any casing and leaves the rest editable', () => {
    const { auth, others } = splitAuthHeaders({
      Authorization: 'Bearer x',
      'X-API-KEY': 'k',
      'Content-Type': 'application/json',
      'X-Custom': 'v',
    });

    expect(Object.keys(auth).sort()).toEqual(['Authorization', 'X-API-KEY']);
    expect(Object.keys(others).sort()).toEqual(['Content-Type', 'X-Custom']);
  });

  it('errs towards editable: an unknown name is never locked', () => {
    expect(isAuthHeaderName('X-Signature')).toBe(false);
    expect(isAuthHeaderName('Authorization')).toBe(true);
  });
});

describe('mergeRetiredHeaders — the round-trip guarantee (the 1.6 modal bug)', () => {
  it('always carries the received auth entries into the merged map, byte-identical', () => {
    const stored = { Authorization: 'Bearer secret-123', 'Content-Type': 'application/json' };

    const merged = mergeRetiredHeaders(stored, { 'Content-Type': 'text/plain' });

    // Dropping Authorization here would erase the migrated secret through the
    // UI: the backend replaces the stored object wholesale on update.
    expect(merged.Authorization).toBe('Bearer secret-123');
    expect(merged['Content-Type']).toBe('text/plain');
  });

  it('drops a NEW auth-named entry typed into the editable half (registration is retired)', () => {
    const stored = { 'Content-Type': 'application/json' };

    const merged = mergeRetiredHeaders(stored, {
      'Content-Type': 'application/json',
      Authorization: 'Bearer typed-inline',
    });

    expect(merged).not.toHaveProperty('Authorization');
  });
});
