import { useEffect, useState } from 'react';
import { listIntegrationCredentials } from '@/services/agents';
import type { IntegrationCredential } from '@/types/agents';

// EVO-2250 story 2.4: only static, active credentials are selectable — an
// `oauth` row is a reference to the store that owns the token and has no
// value a consumer could inject.
export function useVaultCredentials() {
  const [credentials, setCredentials] = useState<IntegrationCredential[]>([]);

  useEffect(() => {
    let cancelled = false;

    listIntegrationCredentials()
      .then(list => {
        if (!cancelled) {
          setCredentials(
            list.filter(credential => credential.kind === 'static' && credential.is_active),
          );
        }
      })
      .catch(error => {
        // Advisory load: a failure leaves the selector empty, it never blocks
        // the host form (the inline secret keeps working as the fallback).
        console.error('Error loading vault credentials:', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return credentials;
}
