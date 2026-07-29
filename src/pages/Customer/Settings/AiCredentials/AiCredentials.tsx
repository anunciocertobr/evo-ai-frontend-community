import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { usePermissions } from '@/contexts/PermissionsContext';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@evoapi/design-system';
import { AlertTriangle, Edit, Key, Loader2, Plus, Trash2 } from 'lucide-react';
import EmptyState from '@/components/base/EmptyState';
import {
  AI_PROVIDERS,
  CUSTOM_OPENAI_PROVIDER,
  isOpenAICompatible,
  maskKey,
  resolveCredential,
} from '@/constants/aiProviders';
import { createApiKey, deleteApiKey, listApiKeys, listAgents, updateApiKey } from '@/services/agents';
import type { ApiKey, ApiKeyCreate, ApiKeyScope, ApiKeyUpdate } from '@/types/agents';

interface CredentialDraft {
  id?: string;
  name: string;
  provider: string;
  key_value: string;
  base_url: string;
  scope: ApiKeyScope;
}

const EMPTY_DRAFT: CredentialDraft = {
  name: '',
  provider: '',
  key_value: '',
  base_url: '',
  scope: 'account',
};

export default function AiCredentials() {
  const { t } = useLanguage('aiCredentials');
  const { can, isReady: permissionsReady } = usePermissions();

  const [credentials, setCredentials] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<CredentialDraft>(EMPTY_DRAFT);
  const [credentialToDelete, setCredentialToDelete] = useState<ApiKey | null>(null);
  const [agentsUsingCredential, setAgentsUsingCredential] = useState<string[]>([]);

  const canRead = can('ai_api_keys', 'read');
  const canCreate = can('ai_api_keys', 'create');
  const canUpdate = can('ai_api_keys', 'update');
  const canDelete = can('ai_api_keys', 'delete');
  // Writing at the installation level is a separate privilege: an account admin
  // sees the inherited default but cannot change it.
  const canManageInstallation = can('installation_configs', 'manage');

  const isEditing = Boolean(draft.id);

  const accountCredentials = useMemo(
    () => credentials.filter(credential => (credential.scope ?? 'account') === 'account'),
    [credentials],
  );

  const installationCredentials = useMemo(
    () => credentials.filter(credential => credential.scope === 'installation'),
    [credentials],
  );

  // Only features already wired to the resolver appear here. Story 1.3 adds the
  // inbox assist and 1.4 the remaining three.
  const featuresInUse = useMemo(
    () => [
      {
        key: 'aiAgents',
        credential: resolveCredential(credentials),
      },
    ],
    [credentials],
  );

  const loadCredentials = useCallback(async () => {
    if (!canRead) {
      toast.error(t('messages.permissionDenied.read'));
      return;
    }

    try {
      setLoading(true);
      setCredentials(await listApiKeys());
    } catch (error) {
      console.error('Error loading AI credentials:', error);
      toast.error(t('messages.loadError'));
    } finally {
      setLoading(false);
    }
  }, [canRead, t]);

  useEffect(() => {
    if (!permissionsReady) {
      return;
    }

    loadCredentials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionsReady]);

  const providerLabel = useCallback(
    (value: string) => AI_PROVIDERS.find(provider => provider.value === value)?.label ?? value,
    [],
  );

  // The backend derives openai_compatible; fall back to the local table so the
  // column still renders against an older core-service.
  const servesAllFeatures = useCallback(
    (credential: ApiKey) => credential.openai_compatible ?? isOpenAICompatible(credential.provider),
    [],
  );

  const draftIsIncompatible = useMemo(
    () => Boolean(draft.provider) && !isOpenAICompatible(draft.provider),
    [draft.provider],
  );

  const openCreateForm = (scope: ApiKeyScope = 'account') => {
    setDraft({ ...EMPTY_DRAFT, scope });
    setFormOpen(true);
  };

  const openEditForm = (credential: ApiKey) => {
    setDraft({
      id: credential.id,
      name: credential.name,
      provider: credential.provider,
      key_value: '',
      base_url: credential.base_url ?? '',
      scope: credential.scope ?? 'account',
    });
    setFormOpen(true);
  };

  // Editing an installation credential needs the installation privilege;
  // account credentials only need ai_api_keys.update.
  const canWriteScope = (scope: ApiKeyScope) =>
    scope === 'installation' ? canManageInstallation : canUpdate;

  const handleSave = async () => {
    const needsKey = !isEditing;
    if (!draft.name.trim() || !draft.provider || (needsKey && !draft.key_value.trim())) {
      toast.error(t('messages.requiredFields'));
      return;
    }

    if (!canWriteScope(draft.scope)) {
      toast.error(t('messages.permissionDenied.installation'));
      return;
    }

    try {
      setSaving(true);

      if (draft.id) {
        const payload: ApiKeyUpdate = {
          name: draft.name,
          provider: draft.provider,
          base_url: draft.base_url || undefined,
          scope: draft.scope,
        };
        // An empty field keeps the stored key: never send a blank key_value.
        if (draft.key_value.trim()) {
          payload.key_value = draft.key_value;
        }

        await updateApiKey(draft.id, payload);
        toast.success(t('messages.updateSuccess'));
      } else {
        const payload: ApiKeyCreate = {
          name: draft.name,
          provider: draft.provider,
          key_value: draft.key_value,
          base_url: draft.base_url || undefined,
          scope: draft.scope,
        };

        await createApiKey(payload);
        toast.success(t('messages.createSuccess'));
      }

      setFormOpen(false);
      setDraft(EMPTY_DRAFT);
      loadCredentials();
    } catch (error) {
      console.error('Error saving AI credential:', error);
      toast.error(t('messages.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (credential: ApiKey) => {
    try {
      setSaving(true);
      await updateApiKey(credential.id, {
        name: credential.name,
        provider: credential.provider,
        is_active: !credential.is_active,
      });
      toast.success(t('messages.updateSuccess'));
      loadCredentials();
    } catch (error) {
      console.error('Error toggling AI credential:', error);
      toast.error(t('messages.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDialog = async (credential: ApiKey) => {
    setCredentialToDelete(credential);
    setAgentsUsingCredential([]);

    try {
      const response = await listAgents();
      const agents = Array.isArray(response) ? response : (response?.data ?? []);
      setAgentsUsingCredential(
        agents.filter(agent => agent.api_key_id === credential.id).map(agent => agent.name),
      );
    } catch (error) {
      // Listing agents is advisory: a failure must not block the deletion flow.
      console.error('Error checking agents using the credential:', error);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!credentialToDelete) {
      return;
    }

    try {
      setSaving(true);
      await deleteApiKey(credentialToDelete.id);
      toast.success(t('messages.deleteSuccess'));
      setCredentialToDelete(null);
      loadCredentials();
    } catch (error) {
      console.error('Error deleting AI credential:', error);
      toast.error(t('messages.deleteError'));
    } finally {
      setSaving(false);
    }
  };

  if (permissionsReady && !canRead) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Key}
          title={t('title')}
          description={t('messages.permissionDenied.read')}
        />
      </div>
    );
  }

  const renderCredentialsTable = (rows: ApiKey[], scope: ApiKeyScope) => {
    const writable = canWriteScope(scope);

    return (
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3">{t('columns.name')}</th>
              <th className="text-left p-3">{t('columns.provider')}</th>
              <th className="text-left p-3">{t('columns.key')}</th>
              <th className="text-left p-3">{t('columns.serves')}</th>
              <th className="text-left p-3">{t('columns.status')}</th>
              <th className="text-right p-3">{t('columns.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(credential => (
              <tr key={credential.id} className="border-t">
                <td className="p-3 font-medium">{credential.name}</td>
                <td className="p-3">
                  <Badge variant="outline">{providerLabel(credential.provider)}</Badge>
                </td>
                <td className="p-3 font-mono">{maskKey(credential.key_hint)}</td>
                <td className="p-3">
                  {servesAllFeatures(credential) ? t('serves.all') : t('serves.agentsOnly')}
                </td>
                <td className="p-3">
                  <Badge variant={credential.is_active ? 'default' : 'secondary'}>
                    {credential.is_active ? t('status.active') : t('status.inactive')}
                  </Badge>
                </td>
                <td className="p-3">
                  <div className="flex justify-end gap-2">
                    {writable ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={t('actions.edit')}
                          onClick={() => openEditForm(credential)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={saving}
                          onClick={() => handleToggleActive(credential)}
                        >
                          {credential.is_active ? t('actions.deactivate') : t('actions.activate')}
                        </Button>
                      </>
                    ) : (
                      scope === 'installation' && (
                        <span className="text-xs text-muted-foreground">
                          {t('inheritedReadOnly')}
                        </span>
                      )
                    )}
                    {canDelete && writable && (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={t('actions.delete')}
                        onClick={() => openDeleteDialog(credential)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        {canCreate && (
          <Button onClick={() => openCreateForm('account')}>
            <Plus className="mr-2 h-4 w-4" />
            {t('actions.add')}
          </Button>
        )}
      </div>

      {/* Answers "which credential is in effect right now". Story 1.3 adds the
          inbox assist row and 1.4 the remaining three. */}
      <section
        aria-label={t('inUse.title')}
        className="border rounded-lg p-4 space-y-2"
      >
        <h2 className="text-sm font-medium">{t('inUse.title')}</h2>

        {featuresInUse.map(feature => (
          <div key={feature.key} className="flex items-baseline gap-2 text-sm">
            <span className="text-muted-foreground">{t(`inUse.features.${feature.key}`)}</span>
            {feature.credential ? (
              <>
                <span className="font-medium">{feature.credential.name}</span>
                <span className="text-xs text-muted-foreground">
                  {(feature.credential.scope ?? 'account') === 'installation'
                    ? t('inUse.fromInstallation')
                    : t('inUse.fromAccount')}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">{t('inUse.none')}</span>
            )}
          </div>
        ))}

        {accountCredentials.length === 0 && installationCredentials.length > 0 && (
          <p className="text-xs text-muted-foreground">{t('inUse.inheritingHint')}</p>
        )}
      </section>

      <section aria-label={t('sections.account')} className="space-y-3">
        <h2 className="text-sm font-medium uppercase text-muted-foreground">
          {t('sections.account')}
        </h2>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : accountCredentials.length === 0 ? (
          <EmptyState
            icon={Key}
            title={t('empty.title')}
            description={t('empty.description')}
            action={
              canCreate
                ? { label: t('actions.addFirst'), onClick: () => openCreateForm('account') }
                : undefined
            }
          />
        ) : (
          renderCredentialsTable(accountCredentials, 'account')
        )}
      </section>

      <section aria-label={t('sections.installation')} className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-medium uppercase text-muted-foreground">
            {t('sections.installation')}
          </h2>
          {canManageInstallation && (
            <Button variant="outline" size="sm" onClick={() => openCreateForm('installation')}>
              <Plus className="mr-2 h-4 w-4" />
              {t('actions.add')}
            </Button>
          )}
        </div>

        {loading ? null : installationCredentials.length === 0 ? (
          <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-4">
            {t('installationEmpty')}
          </p>
        ) : (
          renderCredentialsTable(installationCredentials, 'installation')
        )}
      </section>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? t('form.title.edit') : t('form.title.new')}
            </DialogTitle>
            <DialogDescription>{t('description')}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="credential-name">{t('form.labels.name')}</Label>
              <Input
                id="credential-name"
                value={draft.name}
                placeholder={t('form.placeholders.name')}
                onChange={event => setDraft({ ...draft, name: event.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="credential-provider">{t('form.labels.provider')}</Label>
              <Select
                value={draft.provider}
                onValueChange={value =>
                  setDraft({
                    ...draft,
                    provider: value,
                    ...(value !== CUSTOM_OPENAI_PROVIDER ? { base_url: '' } : {}),
                  })
                }
              >
                <SelectTrigger id="credential-provider">
                  <SelectValue placeholder={t('form.placeholders.provider')} />
                </SelectTrigger>
                <SelectContent>
                  {AI_PROVIDERS.map(provider => (
                    <SelectItem key={provider.value} value={provider.value}>
                      {provider.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {draft.provider === CUSTOM_OPENAI_PROVIDER && (
              <div className="grid gap-2">
                <Label htmlFor="credential-base-url">{t('form.labels.baseUrl')}</Label>
                <Input
                  id="credential-base-url"
                  value={draft.base_url}
                  placeholder="https://api.example.com/v1"
                  onChange={event => setDraft({ ...draft, base_url: event.target.value })}
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="credential-key">{t('form.labels.key')}</Label>
              <Input
                id="credential-key"
                type="password"
                value={draft.key_value}
                placeholder={
                  isEditing ? t('form.placeholders.keyEdit') : t('form.placeholders.keyNew')
                }
                onChange={event => setDraft({ ...draft, key_value: event.target.value })}
              />
            </div>

            {draftIsIncompatible && (
              <p role="alert" className="flex gap-2 text-sm text-amber-600">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                {t('form.incompatibleWarning', { provider: providerLabel(draft.provider) })}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              {t('actions.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('actions.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(credentialToDelete)}
        onOpenChange={open => !open && setCredentialToDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('deleteDialog.description', { name: credentialToDelete?.name })}
            </DialogDescription>
          </DialogHeader>

          {agentsUsingCredential.length > 0 && (
            <p role="alert" className="flex gap-2 text-sm text-amber-600">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              {t('deleteDialog.inUseWarning', {
                count: agentsUsingCredential.length,
                agents: agentsUsingCredential.join(', '),
              })}
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCredentialToDelete(null)}>
              {t('deleteDialog.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('deleteDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
