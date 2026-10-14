import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Button, Label, Switch } from '@evoapi/design-system';
import inboxesService from '@/services/channels/inboxesService';
import type { Inbox } from '@/types/channels/inbox';
import { adminConfigService } from '@/services/admin/adminConfigService';
import type { NotifyChannel } from '@/services/admin/metaLeadNotificationSettingsService';
import { NotifyChannelsEditor } from './NotifyChannelsEditor';

const CONFIG_TYPE = 'meta_leads_notify';

interface DefaultSettings {
  [key: string]: string;
  META_LEADS_NOTIFY_ENABLED: string;
  META_LEADS_NOTIFY_INBOX_ID: string;
  META_LEADS_NOTIFY_WHATSAPP_NUMBER: string;
  META_LEADS_NOTIFY_CHANNELS: string;
}

const DEFAULTS: DefaultSettings = {
  META_LEADS_NOTIFY_ENABLED: 'false',
  META_LEADS_NOTIFY_INBOX_ID: '',
  META_LEADS_NOTIFY_WHATSAPP_NUMBER: '',
  META_LEADS_NOTIFY_CHANNELS: '[]',
};

// Lê META_LEADS_NOTIFY_CHANNELS (formato novo); se vazio, cai pro par antigo
// INBOX_ID/WHATSAPP_NUMBER como canal legado único — mesma lógica de
// fallback que o backend já faz (WhatsappNotifierService#account_default_channels).
const parseChannels = (settings: DefaultSettings): NotifyChannel[] => {
  if (settings.META_LEADS_NOTIFY_CHANNELS) {
    try {
      const parsed = JSON.parse(settings.META_LEADS_NOTIFY_CHANNELS);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // ignora JSON inválido, cai pro legado abaixo
    }
  }
  if (settings.META_LEADS_NOTIFY_INBOX_ID && settings.META_LEADS_NOTIFY_WHATSAPP_NUMBER) {
    return [{ inbox_id: settings.META_LEADS_NOTIFY_INBOX_ID, whatsapp_number: settings.META_LEADS_NOTIFY_WHATSAPP_NUMBER }];
  }
  return [];
};

interface MetaLeadsNotifyDefaultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MetaLeadsNotifyDefaultDialog({ open, onOpenChange }: MetaLeadsNotifyDefaultDialogProps) {
  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  const [settings, setSettings] = useState<DefaultSettings>(DEFAULTS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [channels, setChannels] = useState<NotifyChannel[]>([]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([inboxesService.list(), adminConfigService.getConfig(CONFIG_TYPE)])
      .then(([inboxResponse, config]) => {
        setInboxes(inboxResponse.data ?? []);
        const merged = {
          ...DEFAULTS,
          ...Object.fromEntries(Object.entries(config).filter(([, v]) => v !== null && v !== undefined)),
        } as DefaultSettings;
        setSettings(merged);
        setChannels(parseChannels(merged));
      })
      .catch(() => toast.error('Erro ao carregar o padrão de notificação da conta.'))
      .finally(() => setLoading(false));
  }, [open]);

  const set = (key: keyof DefaultSettings, value: string) => setSettings((prev) => ({ ...prev, [key]: value }));
  const enabled = settings.META_LEADS_NOTIFY_ENABLED === 'true';

  const handleSave = async () => {
    setSaving(true);
    try {
      const validChannels = channels.filter((c) => c.inbox_id && c.whatsapp_number);
      await adminConfigService.saveConfig(CONFIG_TYPE, {
        ...settings,
        META_LEADS_NOTIFY_CHANNELS: JSON.stringify(validChannels),
      });
      toast.success('Padrão de notificação salvo!');
      onOpenChange(false);
    } catch {
      toast.error('Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Notificação de leads — padrão da conta</DialogTitle>
          <DialogDescription>
            Vale pra todo formulário que não tiver uma configuração própria (botão de sininho em cada
            formulário).
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-6">Carregando...</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Notificar por WhatsApp</Label>
              <Switch checked={enabled} onCheckedChange={(c) => set('META_LEADS_NOTIFY_ENABLED', c ? 'true' : 'false')} />
            </div>

            {enabled && <NotifyChannelsEditor channels={channels} onChange={setChannels} inboxes={inboxes} />}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
