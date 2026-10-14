import { Plus, Trash2 } from 'lucide-react';
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@evoapi/design-system';
import type { Inbox } from '@/types/channels/inbox';
import type { NotifyChannel } from '@/services/admin/metaLeadNotificationSettingsService';

interface Props {
  channels: NotifyChannel[];
  onChange: (channels: NotifyChannel[]) => void;
  inboxes: Inbox[];
}

// Lista de pares canal(inbox)+número, com botão "+" pra adicionar mais de um
// — pedido do Marco: "quero que tenha um botão + para dar pra adicionar mais
// um canal com número de destino". Usado tanto no padrão da conta
// (MetaLeadsNotifyDefaultDialog) quanto por formulário
// (LeadFormNotifySettingsDialog), por isso ficou num componente à parte.
export function NotifyChannelsEditor({ channels, onChange, inboxes }: Props) {
  const update = (index: number, patch: Partial<NotifyChannel>) => {
    onChange(channels.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const remove = (index: number) => {
    onChange(channels.filter((_, i) => i !== index));
  };

  const add = () => {
    onChange([...channels, { inbox_id: '', whatsapp_number: '' }]);
  };

  return (
    <div className="space-y-3">
      {channels.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhum canal adicionado ainda.</p>
      )}
      {channels.map((channel, index) => (
        <div key={index} className="flex items-end gap-2 rounded-lg border p-2.5">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs">Canal (inbox) que envia</Label>
            <Select value={channel.inbox_id} onValueChange={(v: string) => update(index, { inbox_id: v })}>
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
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs">Número que recebe</Label>
            <Input
              value={channel.whatsapp_number}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => update(index, { whatsapp_number: e.target.value })}
              placeholder="+55 11 99999-9999"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={() => remove(index)} className="shrink-0 text-destructive">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} className="w-full">
        <Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar canal
      </Button>
    </div>
  );
}
