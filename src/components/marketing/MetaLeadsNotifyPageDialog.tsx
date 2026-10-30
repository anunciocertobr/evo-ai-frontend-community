import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Button, Label, Switch } from '@evoapi/design-system';
import inboxesService from '@/services/channels/inboxesService';
import type { Inbox } from '@/types/channels/inbox';
import { metaLeadPageSettingsService } from '@/services/admin/metaLeadPageSettingsService';
import type { NotifyChannel } from '@/services/admin/metaLeadNotificationSettingsService';
import { NotifyChannelsEditor } from './NotifyChannelsEditor';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageId: string;
  pageName: string;
}

// Notificação padrão desta PÁGINA (não da conta) — usa o mesmo
// MetaLeadPageSetting do card "Padrão por Página" em Configurações > Lead
// Ads (metaLeadPageSettingsService), só editado direto daqui pra não
// precisar trocar de tela no fluxo de criação. Soma com a config do
// formulário específico, nunca sobrescreve (ver
// WhatsappNotifierService#resolve_destinations) — e, por ser scoped por
// page_id, uma Página nunca herda o canal configurado pra outra Página.
// Antes este botão editava MetaLeadsNotifyDefaultDialog (padrão da CONTA,
// um balde só compartilhado por todas as Páginas) apesar de aparecer aqui
// dentro do contexto de uma Página específica — por isso configurar pra
// uma Página "vazava" pra todas as outras sem config própria.
export function MetaLeadsNotifyPageDialog({ open, onOpenChange, pageId, pageName }: Props) {
  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<NotifyChannel[]>([]);
  const [enabled, setEnabled] = useState(false);
  // Preserva o que a Página já tem salvo (pipelines/dataset_ids) pra não
  // apagar ao salvar só os canais daqui — o upsert sempre manda os três.
  const [existingPipelines, setExistingPipelines] = useState<Array<{ pipeline_id: string; pipeline_stage_id: string }>>([]);
  const [existingDatasetIds, setExistingDatasetIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open || !pageId) return;
    setLoading(true);
    Promise.all([inboxesService.list(), metaLeadPageSettingsService.get(pageId)])
      .then(([inboxResponse, settings]) => {
        setInboxes(inboxResponse.data ?? []);
        setChannels(settings.channels);
        setEnabled(settings.channels.length > 0);
        setExistingPipelines(settings.pipelines.map((p) => ({ pipeline_id: p.pipeline_id, pipeline_stage_id: p.pipeline_stage_id })));
        setExistingDatasetIds(settings.dataset_ids);
      })
      .catch(() => toast.error('Erro ao carregar a notificação desta Página.'))
      .finally(() => setLoading(false));
  }, [open, pageId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const validChannels = enabled ? channels.filter((c) => c.inbox_id && (c.whatsapp_number || c.group_jid)) : [];
      await metaLeadPageSettingsService.upsert(pageId, {
        channels: validChannels,
        dataset_ids: existingDatasetIds,
        pipelines: existingPipelines,
      });
      toast.success('Notificação desta Página salva!');
      onOpenChange(false);
    } catch {
      toast.error('Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="truncate" title={pageName}>
            Notificação de leads — {pageName}
          </DialogTitle>
          <DialogDescription>
            Vale só pros formulários desta Página — soma com a configuração própria de cada formulário
            (nunca sobrescreve; botão de sininho em cada formulário), nunca com a de outra Página.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-6">Carregando...</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Notificar por WhatsApp</Label>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
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
