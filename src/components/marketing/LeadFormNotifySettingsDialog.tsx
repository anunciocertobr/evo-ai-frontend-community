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
import { metaLeadNotificationSettingsService } from '@/services/admin/metaLeadNotificationSettingsService';

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
  const [inboxId, setInboxId] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
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
        setInboxId(current?.inbox_id ?? '');
        setWhatsappNumber(current?.whatsapp_number ?? '');
      })
      .catch(() => toast.error('Erro ao carregar configuração de notificação.'))
      .finally(() => setLoading(false));
  }, [open, formId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (useOverride) {
        await metaLeadNotificationSettingsService.upsert(formId, {
          page_id: pageId,
          form_name: formName,
          enabled,
          inbox_id: inboxId || null,
          whatsapp_number: whatsappNumber || null,
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
      <DialogContent className="sm:max-w-lg">
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
                <div className="space-y-1.5">
                  <Label className="text-xs">Canal (inbox) que envia</Label>
                  <Select value={inboxId} onValueChange={setInboxId}>
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
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
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
