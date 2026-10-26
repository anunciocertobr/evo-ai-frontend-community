import { useState, useEffect, useCallback } from 'react';
import { GoogleAdsConnection } from '@/types/integrations';
import { integrationsService } from '@/services/integrations';

interface UseGoogleAdsConnectionsOptions {
  autoLoad?: boolean;
}

interface UseGoogleAdsConnectionsReturn {
  connections: GoogleAdsConnection[];
  loading: boolean;
  error: string | null;
  loadConnections: () => Promise<void>;
}

// Carrega todas as conexões Google Ads (1 por MCC/login) com suas árvores
// de contas — usado pelo seletor compartilhado (GoogleAdsAccountSelector)
// e pela tela de Settings.
export function useGoogleAdsConnections(options: UseGoogleAdsConnectionsOptions = {}): UseGoogleAdsConnectionsReturn {
  const { autoLoad = true } = options;
  const [connections, setConnections] = useState<GoogleAdsConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await integrationsService.listGoogleAdsConnections();
      setConnections(result);
    } catch (err) {
      console.error('Error loading Google Ads connections:', err);
      setError('Erro ao carregar conexões do Google Ads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoLoad) {
      loadConnections();
    }
  }, [autoLoad, loadConnections]);

  return { connections, loading, error, loadConnections };
}
