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
  Badge,
  Textarea,
} from '@evoapi/design-system';
import { Plus, X } from 'lucide-react';
import {
  googleAdsCreationService,
  type AudiencePayload,
  type GoogleAdsAsset,
} from '@/services/marketing/googleAdsCreationService';

interface GoogleAdsAudienceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  editing?: GoogleAdsAsset<AudiencePayload> | null;
}

function ChipListInput({
  label,
  placeholder,
  items,
  onChange,
}: {
  label: string;
  placeholder: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const value = draft.trim();
    if (!value || items.includes(value)) {
      setDraft('');
      return;
    }
    onChange([...items, value]);
    setDraft('');
  };

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" size="icon" onClick={add}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5 min-h-[1.75rem]">
        {items.length === 0 ? (
          <span className="text-xs text-muted-foreground">Nenhum item ainda.</span>
        ) : (
          items.map((item) => (
            <Badge key={item} variant="outline" className="gap-1">
              {item}
              <button type="button" onClick={() => onChange(items.filter((i) => i !== item))}>
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))
        )}
      </div>
    </div>
  );
}

export function GoogleAdsAudienceDialog({ open, onOpenChange, onSaved, editing }: GoogleAdsAudienceDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [apps, setApps] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setDescription(editing?.payload.description ?? '');
    setKeywords(editing?.payload.keywords ?? []);
    setUrls(editing?.payload.urls ?? []);
    setApps(editing?.payload.apps ?? []);
  }, [open, editing]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Dê um nome pro público.');
      return;
    }
    if (keywords.length === 0 && urls.length === 0 && apps.length === 0) {
      toast.error('Adicione ao menos uma palavra-chave, URL ou app.');
      return;
    }
    setSaving(true);
    try {
      const payload: AudiencePayload = { description: description.trim() || undefined, keywords, urls, apps };
      if (editing) {
        await googleAdsCreationService.update(editing.id, name.trim(), payload);
        toast.success('Público atualizado');
      } else {
        await googleAdsCreationService.create('audience', name.trim(), payload);
        toast.success('Público criado');
      }
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao salvar o público — confira se já não existe um com esse nome.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar público personalizado' : 'Novo público personalizado'}</DialogTitle>
          <DialogDescription>
            Segmento por palavras-chave, URLs e apps — mesma lógica do "Custom Segment" do Google Ads. Sem conta
            conectada ainda, isso fica salvo aqui pra criar de verdade assim que a integração estiver pronta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome do público</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Interessados em franquias" />
          </div>

          <div className="space-y-1.5">
            <Label>Descrição (opcional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Pra que serve esse público"
              rows={2}
            />
          </div>

          <ChipListInput
            label="Palavras-chave / termos de busca"
            placeholder="Ex: curso de bombeiro civil"
            items={keywords}
            onChange={setKeywords}
          />
          <ChipListInput
            label="URLs (sites que a pessoa visitou/pesquisou)"
            placeholder="Ex: concorrente.com.br"
            items={urls}
            onChange={setUrls}
          />
          <ChipListInput
            label="Apps"
            placeholder="Ex: com.concorrente.app"
            items={apps}
            onChange={setApps}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
