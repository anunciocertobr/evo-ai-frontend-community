import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
  Switch,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@evoapi/design-system';
import inboxesService from '@/services/channels/inboxesService';
import type { Inbox } from '@/types/channels/inbox';
import { adminConfigService } from '@/services/admin/adminConfigService';

const CONFIG_TYPE = 'meta_leads_notify';

interface DefaultSettings {
  [key: string]: string;
  META_LEADS_NOTIFY_ENABLED: string;
  META_LEADS_NOTIFY_INBOX_ID: string;
  META_LEADS_NOTIFY_WHATSAPP_NUMBER: string;
}

const DEFAULTS: DefaultSettings = {
  META_LEADS_NOTIFY_ENABLED: 'false',
  META_LEADS_NOTIFY_INBOX_ID: '',
  META_LEADS_NOTIFY_WHATSAPP_NUMBER: '',
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

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([inboxesService.list(), adminConfigService.getConfig(CONFIG_TYPE)])
      .then(([inboxResponse, config]) => {
        setInboxes(inboxResponse.data ?? []);
        setSettings((prev) =>
          ({
            ...prev,
            ...Object.fromEntries(Object.entries(config).filter(([, v]) => v !== null && v !== undefined)),
          }) as DefaultSettings,
        );
      })
      .catch(() => toast.error('Erro ao carregar o padrão de notificação da conta.'))
      .finally(() => setLoading(false));
  }, [open]);

  const set = (key: keyof DefaultSettings, value: string) => setSettings((prev) => ({ ...prev, [key]: value }));
  const enabled = settings.META_LEADS_NOTIFY_ENABLED === 'true';

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminConfigService.saveConfig(CONFIG_TYPE, settings);
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

            {enabled && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Canal (inbox) que envia</Label>
                  <Select
                    value={settings.META_LEADS_NOTIFY_INBOX_ID}
                    onValueChange={(v) => set('META_LEADS_NOTIFY_INBOX_ID', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {inboxes.length === 0 ? (
                        <SelectItem value="none" disabled>
                          Nenhum canal encontrado
                        </SelectItem>
                      ) : (
                        inboxes.map((inbox) => (
                          <SelectItem key={inbox.id} value={inbox.id}>
                            {inbox.name} ({inbox.channel_type.replace('Channel::', '')})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Número que recebe</Label>
                  <Input
                    value={settings.META_LEADS_NOTIFY_WHATSAPP_NUMBER}
                    onChange={(e) => set('META_LEADS_NOTIFY_WHATSAPP_NUMBER', e.target.value)}
                    placeholder="+55 11 99999-9999"
                  />
                </div>
              </>
            )}
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
