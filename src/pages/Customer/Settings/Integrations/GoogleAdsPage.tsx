import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, CheckCircle, Loader2, Lock, LockOpen, AlertTriangle } from 'lucide-react';
import {
  Button,
  Input,
  Label,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  RadioGroup,
  RadioGroupItem,
} from '@evoapi/design-system';
import { toast } from 'sonner';
import IntegrationBackButton from '@/components/integrations/shared/IntegrationBackButton';
import { adminConfigService } from '@/services/admin/adminConfigService';
import { integrationsService } from '@/services/integrations';
import { useGoogleAdsConnections } from '@/hooks/integrations';
import { Integration, GoogleAdsConnection } from '@/types/integrations';

function isMasked(value: unknown): boolean {
  return typeof value === 'string' && value.includes('••••');
}

export default function GoogleAdsPage() {
  const navigate = useNavigate();
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [loadingIntegration, setLoadingIntegration] = useState(true);

  const [devToken, setDevToken] = useState('');
  const [devTokenModified, setDevTokenModified] = useState(false);
  const [devTokenConfigured, setDevTokenConfigured] = useState(false);
  const [savingToken, setSavingToken] = useState(false);

  const { connections, loading: connectionsLoading, loadConnections } = useGoogleAdsConnections();
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  const loadIntegration = useCallback(async () => {
    setLoadingIntegration(true);
    try {
      const [config, app] = await Promise.all([
        adminConfigService.getConfig('google_ads'),
        integrationsService.getIntegration('google_ads'),
      ]);
      setDevTokenConfigured(isMasked(config.GOOGLE_ADS_DEVELOPER_TOKEN));
      setDevTokenModified(false);
      setDevToken('');
      setIntegration(app);
    } catch {
      toast.error('Erro ao carregar integração do Google Ads.');
    } finally {
      setLoadingIntegration(false);
    }
  }, []);

  useEffect(() => {
    loadIntegration();
  }, [loadIntegration]);

  const handleSaveDevToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!devTokenModified) return;

    setSavingToken(true);
    try {
      await adminConfigService.saveConfig('google_ads', { GOOGLE_ADS_DEVELOPER_TOKEN: devToken || null });
      toast.success('Developer Token salvo com sucesso!');
      await loadIntegration();
    } catch {
      toast.error('Erro ao salvar Developer Token.');
    } finally {
      setSavingToken(false);
    }
  };

  const handleConnect = () => {
    if (integration?.action) {
      window.location.href = integration.action;
    }
  };

  const handleDisconnect = async (hookId: string) => {
    setDisconnectingId(hookId);
    try {
      await integrationsService.deleteIntegrationHook(hookId);
      toast.success('Conexão removida.');
      await loadConnections();
    } catch {
      toast.error('Erro ao desconectar.');
    } finally {
      setDisconnectingId(null);
    }
  };

  if (loadingIntegration) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center gap-4 mb-6">
        <IntegrationBackButton onBack={() => navigate('/settings/integrations')} />
      </div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Google Ads</h1>
          <p className="text-muted-foreground text-sm">
            Conecte uma ou mais contas gerenciadoras (MCC) do Google Ads para criar, publicar e acompanhar campanhas.
            Cada MCC conectado fica disponível pra escolher na Criação Google Ads e nos Relatórios.
          </p>
        </div>
        <Button onClick={handleConnect} disabled={!integration?.action} className="shrink-0">
          <Plus className="w-4 h-4 mr-2" /> Adicionar MCC
        </Button>
      </div>

      <div className="max-w-xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Developer Token</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveDevToken} className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ga_dev_token">Developer Token</Label>
                  {!devTokenModified &&
                    (devTokenConfigured ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600">
                        <Lock className="h-3 w-3" /> Configurado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <LockOpen className="h-3 w-3" /> Não configurado
                      </span>
                    ))}
                </div>
                <Input
                  id="ga_dev_token"
                  type="password"
                  autoComplete="off"
                  placeholder={devTokenConfigured ? '••••••••' : 'Seu developer token do Google Ads'}
                  value={devToken}
                  onChange={(e) => {
                    setDevToken(e.target.value);
                    setDevTokenModified(e.target.value.length > 0);
                  }}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Único para todo o sistema (não é por conexão) — emitido no{' '}
                <a
                  href="https://ads.google.com/aw/apicenter"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Centro de API
                </a>{' '}
                de uma das suas contas gerenciadoras (MCC) do Google Ads.
              </p>

              <Button type="submit" disabled={savingToken || !devTokenModified}>
                {savingToken ? 'Salvando...' : 'Salvar Developer Token'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {connectionsLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando conexões...
          </div>
        ) : connections.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              Nenhum MCC conectado ainda. Clique em &quot;Adicionar MCC&quot; acima.
            </CardContent>
          </Card>
        ) : (
          connections.map((conn) =>
            conn.reference_id ? (
              <GoogleAdsConnectionCard
                key={conn.hook_id}
                connection={conn}
                disconnecting={disconnectingId === conn.hook_id}
                onDisconnect={() => handleDisconnect(conn.hook_id)}
              />
            ) : (
              <GoogleAdsPendingConnectionCard
                key={conn.hook_id}
                connection={conn}
                disconnecting={disconnectingId === conn.hook_id}
                onFinalized={loadConnections}
                onDisconnect={() => handleDisconnect(conn.hook_id)}
              />
            ),
          )
        )}
      </div>
    </div>
  );
}

function GoogleAdsConnectionCard({
  connection,
  disconnecting,
  onDisconnect,
}: {
  connection: GoogleAdsConnection;
  disconnecting: boolean;
  onDisconnect: () => void;
}) {
  const accounts = connection.accounts.filter((a) => a.id !== connection.reference_id);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
          <div>
            <p className="font-medium">{connection.mcc_name || connection.reference_id}</p>
            <p className="text-xs text-muted-foreground">
              {connection.email ? `${connection.email} · ` : ''}MCC {connection.reference_id}
            </p>
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={onDisconnect} disabled={disconnecting}>
          {disconnecting ? '...' : 'Desconectar'}
        </Button>
      </CardHeader>
      <CardContent>
        {connection.error ? (
          <p className="text-sm text-red-600 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {connection.error}
          </p>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma conta encontrada sob este MCC.</p>
        ) : (
          <ul className="text-sm space-y-1 max-h-48 overflow-y-auto">
            {accounts.map((a) => (
              <li key={a.id} style={{ paddingLeft: `${(a.level || 0) * 12}px` }} className="text-muted-foreground">
                <span className="text-foreground">{a.name || a.id}</span>{' '}
                <span className="text-xs">({a.id})</span>
                {a.manager && <span className="ml-1.5 text-xs rounded bg-amber-100 text-amber-800 px-1.5 py-0.5">MCC</span>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// Caso raro: o login viu mais de 1 MCC/conta direto ao conectar. Fica
// pendente (sem reference_id) até escolher qual dos candidatos é esta
// conexão — pra conectar o(s) outro(s) também, use "Adicionar MCC" de novo.
function GoogleAdsPendingConnectionCard({
  connection,
  disconnecting,
  onFinalized,
  onDisconnect,
}: {
  connection: GoogleAdsConnection;
  disconnecting: boolean;
  onFinalized: () => void;
  onDisconnect: () => void;
}) {
  const [selected, setSelected] = useState('');
  const [saving, setSaving] = useState(false);
  const candidates = connection.pending_candidates || [];

  const handleFinalize = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await integrationsService.finalizeGoogleAdsConnection(connection.hook_id, selected);
      toast.success('Conexão finalizada!');
      await onFinalized();
    } catch {
      toast.error('Erro ao finalizar a conexão.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-amber-300">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" /> Finalize esta conexão
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {connection.email ? `${connection.email} enxerga` : 'Esse login enxerga'} mais de um MCC/conta diretamente.
          Escolha qual deles é esta conexão (pra conectar os outros, use &quot;Adicionar MCC&quot; de novo, um por vez).
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Não há candidatos salvos — desconecte e tente de novo.</p>
        ) : (
          <RadioGroup value={selected} onValueChange={setSelected}>
            {candidates.map((c) => (
              <div key={c.id} className="flex items-start gap-2 py-1">
                <RadioGroupItem value={c.id} id={`ga_pending_${connection.hook_id}_${c.id}`} className="mt-1" />
                <Label htmlFor={`ga_pending_${connection.hook_id}_${c.id}`} className="font-normal cursor-pointer">
                  <span className="font-medium">{c.name || c.id}</span>{' '}
                  <span className="text-xs text-muted-foreground">({c.id})</span>
                  {c.manager && (
                    <span className="ml-2 text-xs rounded bg-amber-100 text-amber-800 px-1.5 py-0.5">MCC</span>
                  )}
                </Label>
              </div>
            ))}
          </RadioGroup>
        )}

        <div className="flex items-center gap-2">
          <Button onClick={handleFinalize} disabled={!selected || saving}>
            {saving ? 'Salvando...' : 'Finalizar'}
          </Button>
          <Button variant="outline" onClick={onDisconnect} disabled={disconnecting}>
            {disconnecting ? '...' : 'Cancelar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
