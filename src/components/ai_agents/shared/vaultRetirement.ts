import { useEffect, useState } from 'react';
import {
  getIntegrationVaultMigrationState,
  type IntegrationVaultMigrationState,
} from '@/services/agents';

// EVO-2250 story 2.7: retirement of the inline secret fields, gated per
// consumer by the migration guard. The rule the 1.6 retirement established and
// this one repeats:
//
//   - The guard failing (network, permission, backend older than 2.7) reads as
//     NOT retired. Removing an input on a broken installation is exactly the
//     silent breakage the guard exists to prevent.
//   - Retiring an input NEVER retires the payload. The backends replace the
//     stored object wholesale on update, so a form that stops sending what it
//     received erases the migrated secret through the UI (the 1.6 modal bug).

const NOT_RETIRED: IntegrationVaultMigrationState = { retired: {} };

export function useVaultMigrationState(enabled = true): IntegrationVaultMigrationState {
  const [state, setState] = useState<IntegrationVaultMigrationState>(NOT_RETIRED);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let cancelled = false;

    getIntegrationVaultMigrationState()
      .then(fetched => {
        if (!cancelled && fetched?.retired) {
          setState(fetched);
        }
      })
      .catch(error => {
        console.error('Error loading vault migration state:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return state;
}

// The conservative auth-name heuristic of story 2.6: recognizable auth headers
// and nothing else. Retiring a header that is not a secret would lock plain
// configuration behind the vault for no reason, so unknown names stay editable.
const AUTH_HEADER_NAMES = new Set(['authorization', 'x-api-key', 'api-key', 'apikey']);

export function isAuthHeaderName(name: string): boolean {
  return AUTH_HEADER_NAMES.has(name.trim().toLowerCase());
}

export interface SplitHeaders {
  auth: Record<string, unknown>;
  others: Record<string, unknown>;
}

export function splitAuthHeaders(headers: Record<string, unknown>): SplitHeaders {
  const auth: Record<string, unknown> = {};
  const others: Record<string, unknown> = {};

  Object.entries(headers ?? {}).forEach(([name, value]) => {
    if (isAuthHeaderName(name)) {
      auth[name] = value;
    } else {
      others[name] = value;
    }
  });

  return { auth, others };
}

// Merges an edit made on the non-auth half back into the full map.
//
// The auth entries the form RECEIVED always survive untouched — that is the
// round-trip guarantee (backends replace the object wholesale). New auth-named
// entries typed into the editable half are dropped: with the consumer retired,
// registering an inline secret is exactly what no longer exists, and the form
// says so next to the editor.
export function mergeRetiredHeaders(
  storedHeaders: Record<string, unknown>,
  editedOthers: Record<string, unknown>,
): Record<string, unknown> {
  const { auth } = splitAuthHeaders(storedHeaders);
  const merged: Record<string, unknown> = { ...auth };

  Object.entries(editedOthers ?? {}).forEach(([name, value]) => {
    if (!isAuthHeaderName(name)) {
      merged[name] = value;
    }
  });

  return merged;
}
