import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, CheckCircle, Loader2, Lock, LockOpen } from 'lucide-react';
import { Button, Input, Label, Card, CardContent, CardHeader, CardTitle } from '@evoapi/design-system';
import { toast } from 'sonner';
import IntegrationBackButton from '@/components/integrations/shared/IntegrationBackButton';
import { adminConfigService } from '@/services/admin/adminConfigService';
import { integrationsService } from '@/services/integrations';
import { Integration, IntegrationHook } from '@/types/integrations';

function isMasked(value: unknown): boolean {
  return typeof value === 'string' && value.includes('••••');
}

// Mesmo padrão de DropboxPage.tsx — conexão (OAuth) cobre
// user.info.basic; publicar de verdade em Gestor de Posts (video.publish)
// só funciona depois da TikTok aprovar a Content Posting API pro app
// (ver comentário em config/integration/apps.yml do backend).
export default function TiktokPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [clientKey, setClientKey] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [secretModified, setSecretModified] = useState(false);
  const [secretConfigured, setSecretConfigured] = useState(false);

  const [integration, setIntegration] = useState<Integration | null>(null);
  const [hook, setHook] = useState<IntegrationHook | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [config, app] = await Promise.all([
        adminConfigService.getConfig('tiktok'),
        integrationsService.getIntegration('tiktok'),
      ]);

      const rawKey = config.TIKTOK_CLIENT_KEY;
      setClientKey(typeof rawKey === 'string' ? rawKey : '');

      setSecretConfigured(isMasked(config.TIKTOK_CLIENT_SECRET));
      setSecretModified(false);
      setClientSecret('');

      setIntegration(app);
      setHook(app.hooks?.find((h) => h.app_id === 'tiktok') || null);
    } catch {
      toast.error('Erro ao carregar configuração do TikTok.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientKey.trim()) {
      toast.error('Informe o Client Key.');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, string | null> = { TIKTOK_CLIENT_KEY: clientKey.trim() };
      if (secretModified) {
        payload.TIKTOK_CLIENT_SECRET = clientSecret || null;
      }
      await adminConfigService.saveConfig('tiktok', payload);
      toast.success('Credenciais salvas com sucesso!');
      await load();
    } catch {
      toast.error('Erro ao salvar credenciais.');
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = () => {
    if (integration?.action) {
      window.location.href = integration.action;
    }
  };

  const handleDisconnect = async () => {
    if (!hook) return;
    setDisconnecting(true);
    try {
      await integrationsService.deleteIntegrationHook(hook.id);
      toast.success('Conta TikTok desconectada.');
      await load();
    } catch {
      toast.error('Erro ao desconectar.');
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const connectedName = (hook?.settings as { display_name?: string } | undefined)?.display_name;
  const callbackUrl = `${window.location.origin}/settings/integrations/tiktok/callback`;

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center gap-4 mb-6">
        <IntegrationBackButton onBack={() => navigate('/settings/integrations')} />
      </div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">TikTok</h1>
        <p className="text-muted-foreground text-sm">
          Conecte uma conta TikTok pra publicar vídeos pelo Gestor de Posts (Marketing &gt; Painel de Tráfego).
          <strong> O app precisa estar aprovado pela TikTok (App Review) antes de qualquer conexão funcionar</strong> —
          confirmado ao vivo: um app pendente/rejeitado recusa o login com &quot;unauthorized_client&quot;, mesmo só
          pedindo o escopo básico de perfil, sem nenhum produto de postagem envolvido. Acompanhe o status da
          revisão no <a href="https://developers.tiktok.com/apps" target="_blank" rel="noreferrer" className="underline">TikTok for Developers</a>.
        </p>
      </div>

      <div className="max-w-xl space-y-6">
        {hook ? (
          <Card>
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                Conectado{connectedName ? ` como ${connectedName}` : ''}
              </div>
              <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
                {disconnecting ? 'Desconectando...' : 'Desconectar'}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Nenhuma conta TikTok conectada ainda.</span>
              <Button onClick={handleConnect} disabled={!integration?.action}>
                <ExternalLink className="w-4 h-4 mr-2" /> Conectar com TikTok
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Credenciais do app TikTok for Developers</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tt_client_key">Client Key</Label>
                <Input
                  id="tt_client_key"
                  value={clientKey}
                  onChange={(e) => setClientKey(e.target.value)}
                  placeholder="ex: aw1a2b3c4d5e6f7g"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="tt_client_secret">Client Secret</Label>
                  {!secretModified &&
                    (secretConfigured ? (
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
                  id="tt_client_secret"
                  type="password"
                  autoComplete="off"
                  placeholder={secretConfigured ? '••••••••' : 'Client Secret'}
                  value={clientSecret}
                  onChange={(e) => {
                    setClientSecret(e.target.value);
                    setSecretModified(e.target.value.length > 0);
                  }}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Crie/edite o app no{' '}
                <a href="https://developers.tiktok.com/apps" target="_blank" rel="noreferrer" className="underline">
                  TikTok for Developers
                </a>{' '}
                com o produto <code className="text-[11px] bg-muted px-1 rounded">Login Kit</code> (e, quando
                aprovado, <code className="text-[11px] bg-muted px-1 rounded">Content Posting API</code>), e cadastre
                esta URL de redirecionamento:
                <br />
                <code className="text-[11px] bg-muted px-1 py-0.5 rounded break-all inline-block mt-1">
                  {callbackUrl}
                </code>
              </p>

              <Button type="submit" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar Credenciais'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
