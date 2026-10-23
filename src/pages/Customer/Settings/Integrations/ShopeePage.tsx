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

export default function ShopeePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [partnerId, setPartnerId] = useState('');
  const [partnerKey, setPartnerKey] = useState('');
  const [keyModified, setKeyModified] = useState(false);
  const [keyConfigured, setKeyConfigured] = useState(false);

  const [integration, setIntegration] = useState<Integration | null>(null);
  const [hook, setHook] = useState<IntegrationHook | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [config, app] = await Promise.all([
        adminConfigService.getConfig('shopee'),
        integrationsService.getIntegration('shopee'),
      ]);

      const rawId = config.SHOPEE_PARTNER_ID;
      setPartnerId(typeof rawId === 'string' ? rawId : '');

      setKeyConfigured(isMasked(config.SHOPEE_PARTNER_KEY));
      setKeyModified(false);
      setPartnerKey('');

      setIntegration(app);
      setHook(app.hooks?.find((h) => h.app_id === 'shopee') || null);
    } catch {
      toast.error('Erro ao carregar configuração da Shopee.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerId.trim()) {
      toast.error('Informe o Partner ID.');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, string | null> = { SHOPEE_PARTNER_ID: partnerId.trim() };
      if (keyModified) {
        payload.SHOPEE_PARTNER_KEY = partnerKey || null;
      }
      await adminConfigService.saveConfig('shopee', payload);
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
      toast.success('Loja Shopee desconectada.');
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

  const shopName = (hook?.settings as { shop_name?: string } | undefined)?.shop_name;
  const callbackUrl = `${window.location.origin}/settings/integrations/shopee/callback`;

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center gap-4 mb-6">
        <IntegrationBackButton onBack={() => navigate('/settings/integrations')} />
      </div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Shopee</h1>
        <p className="text-muted-foreground text-sm">
          Conecte uma loja Shopee para publicar produtos e importar pedidos para o CRM.
        </p>
      </div>

      <div className="max-w-xl space-y-6">
        {hook ? (
          <Card>
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                Conectado{shopName ? ` como ${shopName}` : ''}
              </div>
              <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
                {disconnecting ? 'Desconectando...' : 'Desconectar'}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Nenhuma loja Shopee conectada ainda.</span>
              <Button onClick={handleConnect} disabled={!integration?.action}>
                <ExternalLink className="w-4 h-4 mr-2" /> Conectar com Shopee
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Credenciais do App Shopee</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="shopee_partner_id">Partner ID</Label>
                <Input
                  id="shopee_partner_id"
                  value={partnerId}
                  onChange={(e) => setPartnerId(e.target.value)}
                  placeholder="ex: 1234567"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="shopee_partner_key">Partner Key</Label>
                  {!keyModified &&
                    (keyConfigured ? (
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
                  id="shopee_partner_key"
                  type="password"
                  autoComplete="off"
                  placeholder={keyConfigured ? '••••••••' : 'Partner Key'}
                  value={partnerKey}
                  onChange={(e) => {
                    setPartnerKey(e.target.value);
                    setKeyModified(e.target.value.length > 0);
                  }}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Crie um app em{' '}
                <a href="https://open.shopee.com" target="_blank" rel="noreferrer" className="underline">
                  Shopee Open Platform
                </a>{' '}
                e cadastre esta URL de redirecionamento:
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
