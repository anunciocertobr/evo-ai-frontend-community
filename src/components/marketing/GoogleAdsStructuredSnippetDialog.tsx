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
  type StructuredSnippetHeader,
  type StructuredSnippetPayload,
  type GoogleAdsAsset,
} from '@/services/marketing/googleAdsCreationService';

const MAX_VALUES = 10;
const MAX_VALUE_CHARS = 25;

const HEADER_LABEL: Record<StructuredSnippetHeader, string> = {
  BRANDS: 'Marcas',
  COURSES: 'Cursos',
  DEGREE_PROGRAMS: 'Programas de graduação',
  DESTINATIONS: 'Destinos',
  FEATURED_HOTELS: 'Hotéis em destaque',
  INSURANCE_COVERAGE: 'Cobertura de seguro',
  MODELS: 'Modelos',
  NEIGHBORHOODS: 'Bairros',
  SERVICE_CATALOG: 'Catálogo de serviços',
  SHOWS: 'Programas',
  STYLES: 'Estilos',
  TYPES: 'Tipos',
  AMENITIES: 'Comodidades',
};

interface GoogleAdsStructuredSnippetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  editing?: GoogleAdsAsset<StructuredSnippetPayload> | null;
}

export function GoogleAdsStructuredSnippetDialog({ open, onOpenChange, onSaved, editing }: GoogleAdsStructuredSnippetDialogProps) {
  const [name, setName] = useState('');
  const [header, setHeader] = useState<StructuredSnippetHeader>('TYPES');
  const [values, setValues] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setHeader(editing?.payload.header ?? 'TYPES');
    setValues(editing?.payload.values ?? []);
    setDraft('');
  }, [open, editing]);

  const addValue = () => {
    const value = draft.trim();
    if (!value) return;
    if (values.length >= MAX_VALUES) {
      toast.error(`Máximo de ${MAX_VALUES} valores.`);
      return;
    }
    if (value.length > MAX_VALUE_CHARS) {
      toast.error(`Máximo de ${MAX_VALUE_CHARS} caracteres.`);
      return;
    }
    setValues((prev) => [...prev, value]);
    setDraft('');
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Dê um nome pro snippet estruturado.');
      return;
    }
    if (values.length < 3) {
      toast.error('O Google Ads exige pelo menos 3 valores por snippet.');
      return;
    }
    setSaving(true);
    try {
      const payload: StructuredSnippetPayload = { header, values };
      if (editing) {
        await googleAdsCreationService.update(editing.id, name.trim(), payload);
        toast.success('Snippet estruturado atualizado');
      } else {
        await googleAdsCreationService.create('structured_snippet', name.trim(), payload);
        toast.success('Snippet estruturado criado');
      }
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao salvar — confira se já não existe um snippet com esse nome.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar snippet estruturado' : 'Novo snippet estruturado'}</DialogTitle>
          <DialogDescription>
            Lista de valores sob um cabeçalho fixo (ex: Tipos: Residencial, Comercial, Industrial) — pelo menos 3
            valores, até {MAX_VALUES}, {MAX_VALUE_CHARS} caracteres cada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nome do snippet</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Tipos de imóvel" />
            </div>
            <div className="space-y-1.5">
              <Label>Cabeçalho</Label>
              <Select value={header} onValueChange={(v) => setHeader(v as StructuredSnippetHeader)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(HEADER_LABEL) as StructuredSnippetHeader[]).map((h) => (
                    <SelectItem key={h} value={h}>
                      {HEADER_LABEL[h]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>
              Valores ({values.length}/{MAX_VALUES})
            </Label>
            <div className="flex gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ex: Residencial"
                maxLength={MAX_VALUE_CHARS}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addValue();
                  }
                }}
              />
              <Button type="button" variant="outline" size="icon" onClick={addValue} disabled={values.length >= MAX_VALUES}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-1.5">
              {values.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Nenhum ainda.</p>
              ) : (
                values.map((item, index) => (
                  <div key={`${item}-${index}`} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-1.5 text-sm">
                    <span className="truncate">{item}</span>
                    <button type="button" onClick={() => setValues((prev) => prev.filter((_, i) => i !== index))}>
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-rose-500" />
                    </button>
                  </div>
                ))
              )}
            </div>
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
