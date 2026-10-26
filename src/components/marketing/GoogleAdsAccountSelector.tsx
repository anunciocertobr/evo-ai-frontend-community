import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@evoapi/design-system';
import { useGoogleAdsConnections } from '@/hooks/integrations';
import { cn } from '@/utils/cn';

export interface GoogleAdsSelection {
  loginCustomerId: string;
  customerId: string;
}

interface GoogleAdsAccountSelectorProps {
  value: GoogleAdsSelection | null;
  onChange: (value: GoogleAdsSelection | null) => void;
  className?: string;
}

// Seletor de 2 níveis (MCC → conta) compartilhado entre Criação Google Ads,
// Relatórios e o diálogo de Publicar — todos consomem a mesma lista de
// conexões (GET /integrations/google_ads/connections, via useGoogleAdsConnections).
export function GoogleAdsAccountSelector({ value, onChange, className }: GoogleAdsAccountSelectorProps) {
  const { connections, loading, error } = useGoogleAdsConnections();

  const usableConnections = connections.filter((c) => c.reference_id);
  const pendingCount = connections.length - usableConnections.length;
  const selectedConnection = usableConnections.find((c) => c.reference_id === value?.loginCustomerId) || null;

  // Sem seleção ainda e só 1 conexão disponível: pré-seleciona sozinho
  // (primeira conta que não é um MCC, senão a primeira da lista).
  useEffect(() => {
    if (value || usableConnections.length !== 1) return;
    const conn = usableConnections[0];
    const firstAccount = conn.accounts.find((a) => !a.manager) || conn.accounts[0];
    if (conn.reference_id && firstAccount) {
      onChange({ loginCustomerId: conn.reference_id, customerId: firstAccount.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usableConnections.length]);

  const handleConnectionChange = (loginCustomerId: string) => {
    const conn = usableConnections.find((c) => c.reference_id === loginCustomerId);
    const firstAccount = conn?.accounts.find((a) => !a.manager) || conn?.accounts[0];
    onChange(firstAccount ? { loginCustomerId, customerId: firstAccount.id } : null);
  };

  const handleAccountChange = (customerId: string) => {
    if (!value) return;
    onChange({ ...value, customerId });
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando contas do Google Ads...
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (usableConnections.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma conta Google Ads conectada.{' '}
        <Link to="/settings/integrations/google_ads" className="underline">
          Conectar agora
        </Link>
      </p>
    );
  }

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex flex-col sm:flex-row gap-2">
        <Select value={selectedConnection?.reference_id || ''} onValueChange={handleConnectionChange}>
          <SelectTrigger className="sm:w-56">
            <SelectValue placeholder="MCC" />
          </SelectTrigger>
          <SelectContent>
            {usableConnections.map((c) => (
              <SelectItem key={c.reference_id as string} value={c.reference_id as string}>
                {c.mcc_name || c.reference_id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={value?.customerId || ''} onValueChange={handleAccountChange} disabled={!selectedConnection}>
          <SelectTrigger className="sm:w-64">
            <SelectValue placeholder="Conta" />
          </SelectTrigger>
          <SelectContent>
            {(selectedConnection?.accounts || []).map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {'—'.repeat(a.level || 0)} {a.name || a.id}
                {a.manager ? ' (MCC)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {pendingCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {pendingCount} conexão(ões) aguardando finalização em{' '}
          <Link to="/settings/integrations/google_ads" className="underline">
            Integrações
          </Link>
          .
        </p>
      )}
    </div>
  );
}
