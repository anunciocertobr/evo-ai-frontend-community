import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, CheckCircle, Loader2, Lock, LockOpen, RefreshCw } from 'lucide-react';
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
import { useLanguage } from '@/hooks/useLanguage';
import IntegrationBackButton from '@/components/integrations/shared/IntegrationBackButton';
import { adminConfigService } from '@/services/admin/adminConfigService';
import { integrationsService } from '@/services/integrations';
import { Integration, IntegrationHook, GoogleAdsAccessibleCustomer, GoogleAdsConfig } from '@/types/integrations';

function isMasked(value: unknown): boolean {
  return typeof value === 'string' && value.includes('••••');
}

export default function GoogleAdsPage() {
  const { t } = useLanguage('integrations');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [savingToken, setSavingToken] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const [devToken, setDevToken] = useState('');
  const [devTokenModified, setDevTokenModified] = useState(false);
  const [devTokenConfigured, setDevTokenConfigured] = useState(false);

  const [integration, setIntegration] = useState<Integration | null>(null);
  const [hook, setHook] = useState<IntegrationHook | null>(null);

  const [customers, setCustomers] = useState<GoogleAdsAccessibleCustomer[] | null>(null);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersError, setCustomersError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [loginCustomerId, setLoginCustomerId] = useState('');
  const [savingCustomer, setSavingCustomer] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [config, app] = await Promise.all([
        adminConfigService.getConfig('google_ads'),
        integrationsService.getIntegration('google_ads'),
      ]);

      setDevTokenConfigured(isMasked(config.GOOGLE_ADS_DEVELOPER_TOKEN));
      setDevTokenModified(false);
      setDevToken('');

      setIntegration(app);
      setHook(app.hooks?.find((h) => h.app_id === 'google_ads') || null);
    } catch {
      toast.error(t('googleAds.connect.picker.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const settings = hook?.settings as GoogleAdsConfig | undefined;

  useEffect(() => {
    if (hook && !settings?.customer_id) {
      setShowPicker(true);
    }
  }, [hook, settings?.customer_id]);

  const loadAccessibleCustomers = useCallback(async () => {
    setCustomersLoading(true);
    setCustomersError(null);
    try {
      const result = await integrationsService.getGoogleAdsAccessibleCustomers();
      setCustomers(result);
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        t('googleAds.connect.picker.error');
      setCustomersError(message);
    } finally {
      setCustomersLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (showPicker && customers === null && !customersLoading) {
      loadAccessibleCustomers();
    }
  }, [showPicker, customers, customersLoading, loadAccessibleCustomers]);

  const handleSaveDevToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!devTokenModified) return;

    setSavingToken(true);
    try {
      await adminConfigService.saveConfig('google_ads', { GOOGLE_ADS_DEVELOPER_TOKEN: devToken || null });
      toast.success(t('genericSettings.messages.updateSuccess', { name: 'Google Ads' }));
      await load();
    } catch {
      toast.error(t('genericSettings.messages.updateError', { name: 'Google Ads' }));
    } finally {
      setSavingToken(false);
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
      toast.success(t('googleAds.connect.connected.disconnect'));
      setCustomers(null);
      setShowPicker(false);
      await load();
    } catch {
      toast.error(t('genericSettings.messages.deleteError', { name: 'Google Ads' }));
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSaveCustomer = async () => {
    if (!selectedCustomerId) return;
    setSavingCustomer(true);
    try {
      await integrationsService.selectGoogleAdsCustomer(selectedCustomerId, loginCustomerId);
      toast.success(t('googleAds.connect.picker.save'));
      setShowPicker(false);
      await load();
    } catch {
      toast.error(t('googleAds.connect.picker.error'));
    } finally {
      setSavingCustomer(false);
    }
  };

  if (loading) {
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
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{t('providers.googleAds.name')}</h1>
        <p className="text-muted-foreground text-sm">{t('googleAds.connect.description')}</p>
      </div>

      <div className="max-w-xl space-y-6">
        {hook ? (
          <Card>
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                {t('googleAds.connect.connected.title', { email: settings?.email || '' })}
              </div>
              <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
                {disconnecting ? '...' : t('googleAds.connect.connected.disconnect')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">{t('googleAds.connect.notConnected.title')}</span>
              <Button onClick={handleConnect} disabled={!integration?.action}>
                <ExternalLink className="w-4 h-4 mr-2" /> {t('googleAds.connect.notConnected.cta')}
              </Button>
            </CardContent>
          </Card>
        )}

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
                Único para todo o sistema (não é por conta conectada) — emitido no{' '}
                <a
                  href="https://ads.google.com/aw/apicenter"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Centro de API
                </a>{' '}
                da sua conta gerenciadora (MCC) do Google Ads.
              </p>

              <Button type="submit" disabled={savingToken || !devTokenModified}>
                {savingToken ? 'Salvando...' : 'Salvar Developer Token'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {hook && !showPicker && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('googleAds.connect.currentAccount.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm">
                <span className="text-muted-foreground">{t('googleAds.connect.currentAccount.customerId')}:</span>{' '}
                {settings?.customer_id}
              </p>
              {settings?.login_customer_id && (
                <p className="text-sm">
                  <span className="text-muted-foreground">
                    {t('googleAds.connect.currentAccount.loginCustomerId')}:
                  </span>{' '}
                  {settings.login_customer_id}
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCustomers(null);
                  setShowPicker(true);
                }}
              >
                <RefreshCw className="w-4 h-4 mr-2" /> {t('googleAds.connect.connected.changeAccount')}
              </Button>
            </CardContent>
          </Card>
        )}

        {hook && showPicker && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('googleAds.connect.picker.title')}</CardTitle>
              <p className="text-sm text-muted-foreground">{t('googleAds.connect.picker.description')}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {customersLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t('googleAds.connect.picker.loading')}
                </div>
              )}

              {!customersLoading && customersError && (
                <p className="text-sm text-red-600">{customersError}</p>
              )}

              {!customersLoading && !customersError && customers?.length === 0 && (
                <p className="text-sm text-muted-foreground">{t('googleAds.connect.picker.empty')}</p>
              )}

              {!customersLoading && !customersError && customers && customers.length > 0 && (
                <>
                  <RadioGroup value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                    {customers.map((customer) => (
                      <div key={customer.id} className="flex items-start gap-2 py-1">
                        <RadioGroupItem value={customer.id} id={`ga_customer_${customer.id}`} className="mt-1" />
                        <Label htmlFor={`ga_customer_${customer.id}`} className="font-normal cursor-pointer">
                          <span className="font-medium">{customer.name || customer.id}</span>{' '}
                          <span className="text-xs text-muted-foreground">({customer.id})</span>
                          {customer.manager && (
                            <span className="ml-2 text-xs rounded bg-amber-100 text-amber-800 px-1.5 py-0.5">
                              {t('googleAds.connect.picker.managerBadge')}
                            </span>
                          )}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>

                  <div className="space-y-2">
                    <Label htmlFor="ga_login_customer_id">
                      {t('googleAds.connect.picker.loginCustomerIdLabel')}
                    </Label>
                    <Input
                      id="ga_login_customer_id"
                      value={loginCustomerId}
                      onChange={(e) => setLoginCustomerId(e.target.value)}
                      placeholder="123-456-7890"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('googleAds.connect.picker.loginCustomerIdHint')}
                    </p>
                  </div>

                  <Button onClick={handleSaveCustomer} disabled={!selectedCustomerId || savingCustomer}>
                    {savingCustomer ? t('googleAds.connect.picker.saving') : t('googleAds.connect.picker.save')}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
