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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@evoapi/design-system';
import { Plus, Trash2 } from 'lucide-react';
import {
  googleAdsCreationService,
  type PriceExtensionType,
  type PriceOfferingEntry,
  type PricePayload,
  type PriceQualifier,
  type PriceUnit,
  type GoogleAdsAsset,
} from '@/services/marketing/googleAdsCreationService';

const MAX_OFFERINGS = 8;

const TYPE_LABEL: Record<PriceExtensionType, string> = {
  BRANDS: 'Marcas',
  EVENTS: 'Eventos',
  LOCATIONS: 'Locais',
  NEIGHBORHOODS: 'Bairros',
  PRODUCT_CATEGORIES: 'Categorias de produto',
  PRODUCT_TIERS: 'Níveis de produto',
  SERVICES: 'Serviços',
  SERVICE_CATEGORIES: 'Categorias de serviço',
  SERVICE_TIERS: 'Níveis de serviço',
};

const QUALIFIER_LABEL: Record<PriceQualifier, string> = {
  FROM: 'A partir de',
  UP_TO: 'Até',
  AVERAGE: 'Em média',
};

const UNIT_LABEL: Record<PriceUnit, string> = {
  PER_HOUR: 'por hora',
  PER_DAY: 'por dia',
  PER_WEEK: 'por semana',
  PER_MONTH: 'por mês',
  PER_YEAR: 'por ano',
  PER_NIGHT: 'por noite',
};

const emptyDraft: PriceOfferingEntry = { header: '', description: '', price: '', unit: undefined, finalUrl: '' };

interface GoogleAdsPriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  editing?: GoogleAdsAsset<PricePayload> | null;
}

export function GoogleAdsPriceDialog({ open, onOpenChange, onSaved, editing }: GoogleAdsPriceDialogProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<PriceExtensionType>('SERVICES');
  const [priceQualifier, setPriceQualifier] = useState<PriceQualifier | undefined>(undefined);
  const [offerings, setOfferings] = useState<PriceOfferingEntry[]>([]);
  const [draft, setDraft] = useState<PriceOfferingEntry>(emptyDraft);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setType(editing?.payload.type ?? 'SERVICES');
    setPriceQualifier(editing?.payload.priceQualifier);
    setOfferings(editing?.payload.offerings ?? []);
    setDraft(emptyDraft);
  }, [open, editing]);

  const addOffering = () => {
    if (!draft.header.trim() || !draft.description.trim() || !draft.price.trim() || !draft.finalUrl.trim()) {
      toast.error('Preencha cabeçalho, descrição, preço e URL final do item.');
      return;
    }
    if (offerings.length >= MAX_OFFERINGS) {
      toast.error(`Máximo de ${MAX_OFFERINGS} itens.`);
      return;
    }
    setOfferings((prev) => [...prev, { ...draft, header: draft.header.trim(), description: draft.description.trim(), price: draft.price.trim(), finalUrl: draft.finalUrl.trim() }]);
    setDraft(emptyDraft);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Dê um nome pra extensão de preço.');
      return;
    }
    if (offerings.length < 3) {
      toast.error('O Google Ads exige pelo menos 3 itens de preço.');
      return;
    }
    setSaving(true);
    try {
      const payload: PricePayload = { type, priceQualifier, offerings };
      if (editing) {
        await googleAdsCreationService.update(editing.id, name.trim(), payload);
        toast.success('Extensão de preço atualizada');
      } else {
        await googleAdsCreationService.create('price', name.trim(), payload);
        toast.success('Extensão de preço criada');
      }
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao salvar — confira se já não existe uma extensão com esse nome.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar extensão de preço' : 'Nova extensão de preço'}</DialogTitle>
          <DialogDescription>
            Carrossel de itens com preço abaixo do anúncio — pelo menos 3 itens, até {MAX_OFFERINGS}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nome da extensão</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Preços - Planos" />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as PriceExtensionType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABEL) as PriceExtensionType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Qualificador de preço (opcional)</Label>
            <Select value={priceQualifier ?? 'none'} onValueChange={(v) => setPriceQualifier(v === 'none' ? undefined : (v as PriceQualifier))}>
              <SelectTrigger className="sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {(Object.keys(QUALIFIER_LABEL) as PriceQualifier[]).map((q) => (
                  <SelectItem key={q} value={q}>
                    {QUALIFIER_LABEL[q]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 border border-border rounded-lg p-3">
            <Label>Adicionar item</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input value={draft.header} onChange={(e) => setDraft((d) => ({ ...d, header: e.target.value }))} placeholder="Cabeçalho (ex: Plano Básico)" maxLength={25} />
              <Input value={draft.price} onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))} placeholder="Preço (ex: 199.90)" />
              <Input value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Descrição" maxLength={25} />
              <Select value={draft.unit ?? 'none'} onValueChange={(v) => setDraft((d) => ({ ...d, unit: v === 'none' ? undefined : (v as PriceUnit) }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Unidade (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem unidade</SelectItem>
                  {(Object.keys(UNIT_LABEL) as PriceUnit[]).map((u) => (
                    <SelectItem key={u} value={u}>
                      {UNIT_LABEL[u]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input value={draft.finalUrl} onChange={(e) => setDraft((d) => ({ ...d, finalUrl: e.target.value }))} placeholder="URL final" className="sm:col-span-2" />
            </div>
            <Button type="button" variant="outline" onClick={addOffering} disabled={offerings.length >= MAX_OFFERINGS}>
              <Plus className="w-4 h-4 mr-1.5" /> Adicionar item
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label>
              Itens adicionados ({offerings.length}/{MAX_OFFERINGS})
            </Label>
            {offerings.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center border border-dashed rounded-md">Nenhum item ainda.</p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {offerings.map((o, index) => (
                  <div key={`${o.header}-${index}`} className="flex items-start justify-between gap-2 rounded-md border border-border px-3 py-1.5 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {o.header} — R$ {o.price} {o.unit ? UNIT_LABEL[o.unit] : ''}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{o.description}</p>
                    </div>
                    <button type="button" onClick={() => setOfferings((prev) => prev.filter((_, i) => i !== index))} className="shrink-0">
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-rose-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
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
