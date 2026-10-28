import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Button, Label, Switch } from '@evoapi/design-system';
import inboxesService from '@/services/channels/inboxesService';
import type { Inbox } from '@/types/channels/inbox';
import { metaLeadNotificationSettingsService, NotifyChannel } from '@/services/admin/metaLeadNotificationSettingsService';
import { NotifyChannelsEditor } from './NotifyChannelsEditor';

interface LeadFormNotifySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageId: string;
  formId: string;
  formName: string;
}

export function LeadFormNotifySettingsDialog({
  open,
  onOpenChange,
  pageId,
  formId,
  formName,
}: LeadFormNotifySettingsDialogProps) {
  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  const [useOverride, setUseOverride] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [channels, setChannels] = useState<NotifyChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([inboxesService.list(), metaLeadNotificationSettingsService.list([formId])])
      .then(([inboxResponse, settings]) => {
        setInboxes(inboxResponse.data ?? []);
        const current = settings[0];
        setUseOverride(Boolean(current));
        setEnabled(current?.enabled ?? true);
        setChannels(current?.channels ?? []);
      })
      .catch(() => toast.error('Erro ao carregar configuração de notificação.'))
      .finally(() => setLoading(false));
  }, [open, formId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (useOverride) {
        const validChannels = channels.filter((c) => c.inbox_id && (c.whatsapp_number || c.group_jid));
        await metaLeadNotificationSettingsService.upsert(formId, {
          page_id: pageId,
          form_name: formName,
          enabled,
          channels: validChannels,
        });
      } else {
        await metaLeadNotificationSettingsService.remove(formId);
      }
      toast.success('Configuração de notificação salva!');
      onOpenChange(false);
    } catch {
      toast.error('Erro ao salvar a configuração de notificação.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Notificar leads por WhatsApp</DialogTitle>
          <DialogDescription className="truncate" title={formName}>
            Formulário: {formName}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-6">Carregando...</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-sm font-semibold">Usar número específico pra este formulário</Label>
                <p className="text-xs text-muted-foreground">
                  Desligado, usa o padrão da conta (configurado em Notificações de Leads).
                </p>
              </div>
              <Switch checked={useOverride} onCheckedChange={setUseOverride} />
            </div>

            {useOverride && (
              <>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Notificação ativa</Label>
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                </div>
                <NotifyChannelsEditor channels={channels} onChange={setChannels} inboxes={inboxes} />
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
