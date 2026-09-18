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
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@evoapi/design-system';
import { Plus, Trash2, Sparkles, Loader2 } from 'lucide-react';
import {
  googleAdsCreationService,
  type HeadlineSetPayload,
  type GoogleAdsAsset,
} from '@/services/marketing/googleAdsCreationService';
import {
  AI_PROVIDER_OPTIONS,
  generateText,
  listAiModels,
  type AiModelOption,
  type AiProvider,
} from '@/services/marketing/aiTextService';

const MAX_HEADLINES = 15;
const MAX_HEADLINE_CHARS = 30;
const MAX_DESCRIPTIONS = 4;
const MAX_DESCRIPTION_CHARS = 90;

interface GoogleAdsHeadlineSetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  editing?: GoogleAdsAsset<HeadlineSetPayload> | null;
}

function LimitedListEditor({
  label,
  items,
  onChange,
  maxItems,
  maxChars,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  maxItems: number;
  maxChars: number;
  placeholder: string;
}) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    if (items.length >= maxItems) {
      toast.error(`Máximo de ${maxItems} itens.`);
      return;
    }
    if (value.length > maxChars) {
      toast.error(`Máximo de ${maxChars} caracteres.`);
      return;
    }
    onChange([...items, value]);
    setDraft('');
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>
          {label} ({items.length}/{maxItems})
        </Label>
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          maxLength={maxChars}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <span className="text-xs text-muted-foreground self-center w-10 text-right shrink-0">
          {draft.length}/{maxChars}
        </span>
        <Button type="button" variant="outline" size="icon" onClick={add} disabled={items.length >= maxItems}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      <div className="space-y-1.5">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">Nenhum ainda.</p>
        ) : (
          items.map((item, index) => (
            <div
              key={`${item}-${index}`}
              className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-1.5 text-sm"
            >
              <span className="truncate">{item}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-muted-foreground">{item.length}</span>
                <button type="button" onClick={() => onChange(items.filter((_, i) => i !== index))}>
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-rose-500" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function GoogleAdsHeadlineSetDialog({
  open,
  onOpenChange,
  onSaved,
  editing,
}: GoogleAdsHeadlineSetDialogProps) {
  const [name, setName] = useState('');
  const [finalUrl, setFinalUrl] = useState('');
  const [headlines, setHeadlines] = useState<string[]>([]);
  const [descriptions, setDescriptions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [aiOpen, setAiOpen] = useState(false);
  const [briefing, setBriefing] = useState('');
  const [provider, setProvider] = useState<AiProvider>('groq');
  const [models, setModels] = useState<AiModelOption[]>([]);
  const [model, setModel] = useState('');
  const [loadingModels, setLoadingModels] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setFinalUrl(editing?.payload.finalUrl ?? '');
    setHeadlines(editing?.payload.headlines ?? []);
    setDescriptions(editing?.payload.descriptions ?? []);
    setAiOpen(false);
    setBriefing('');
  }, [open, editing]);

  useEffect(() => {
    if (!aiOpen) return;
    setLoadingModels(true);
    setModel('');
    listAiModels(provider)
      .then((opts) => {
        setModels(opts);
        if (opts[0]) setModel(opts[0].id);
      })
      .catch(() => toast.error('Não foi possível carregar os modelos desse provedor.'))
      .finally(() => setLoadingModels(false));
  }, [aiOpen, provider]);

  const handleGenerate = async () => {
    if (!briefing.trim()) {
      toast.error('Descreva o produto/serviço e o público pra IA gerar os textos.');
      return;
    }
    if (!model) {
      toast.error('Selecione um modelo de IA.');
      return;
    }
    setGenerating(true);
    try {
      const remainingHeadlines = MAX_HEADLINES - headlines.length;
      const remainingDescriptions = MAX_DESCRIPTIONS - descriptions.length;
      const prompt = `Você é um especialista em Google Ads (Responsive Search Ads). Com base neste briefing:\n"""${briefing.trim()}"""\n\nGere exatamente ${Math.max(remainingHeadlines, 1)} títulos (cada um com NO MÁXIMO 30 caracteres) e ${Math.max(remainingDescriptions, 1)} descrições (cada uma com NO MÁXIMO 90 caracteres). Responda SOMENTE em JSON válido, sem markdown, no formato exato: {"headlines": ["...", "..."], "descriptions": ["...", "..."]}`;
      const raw = await generateText(provider, model, prompt);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('formato inesperado');
      const parsed = JSON.parse(jsonMatch[0]) as { headlines?: string[]; descriptions?: string[] };

      const newHeadlines = (parsed.headlines || [])
        .map((h) => h.trim())
        .filter((h) => h && h.length <= MAX_HEADLINE_CHARS)
        .slice(0, remainingHeadlines);
      const newDescriptions = (parsed.descriptions || [])
        .map((d) => d.trim())
        .filter((d) => d && d.length <= MAX_DESCRIPTION_CHARS)
        .slice(0, remainingDescriptions);

      if (newHeadlines.length === 0 && newDescriptions.length === 0) {
        toast.error('A IA não retornou nenhum título/descrição dentro do limite de caracteres.');
        return;
      }

      setHeadlines((prev) => [...prev, ...newHeadlines].slice(0, MAX_HEADLINES));
      setDescriptions((prev) => [...prev, ...newDescriptions].slice(0, MAX_DESCRIPTIONS));
      toast.success(`${newHeadlines.length} título(s) e ${newDescriptions.length} descrição(ões) gerados`);
    } catch {
      toast.error('Erro ao gerar com IA — tente outro modelo ou ajuste o briefing.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Dê um nome pro conjunto.');
      return;
    }
    if (headlines.length < 3) {
      toast.error('O Google Ads exige pelo menos 3 títulos por anúncio responsivo.');
      return;
    }
    if (descriptions.length < 2) {
      toast.error('O Google Ads exige pelo menos 2 descrições por anúncio responsivo.');
      return;
    }
    setSaving(true);
    try {
      const payload: HeadlineSetPayload = { finalUrl: finalUrl.trim() || undefined, headlines, descriptions };
      if (editing) {
        await googleAdsCreationService.update(editing.id, name.trim(), payload);
        toast.success('Conjunto atualizado');
      } else {
        await googleAdsCreationService.create('headline_set', name.trim(), payload);
        toast.success('Conjunto criado');
      }
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao salvar — confira se já não existe um conjunto com esse nome.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar títulos e descrições' : 'Novo conjunto de títulos e descrições'}</DialogTitle>
          <DialogDescription>
            Anúncio responsivo de pesquisa (RSA): até {MAX_HEADLINES} títulos (30 caracteres cada) e{' '}
            {MAX_DESCRIPTIONS} descrições (90 caracteres cada). Digite manualmente ou gere com IA.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nome do conjunto</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: RSA - Bombeiro Civil" />
            </div>
            <div className="space-y-1.5">
              <Label>URL final (opcional)</Label>
              <Input
                value={finalUrl}
                onChange={(e) => setFinalUrl(e.target.value)}
                placeholder="https://seusite.com.br/pagina"
              />
            </div>
          </div>

          <div className="rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setAiOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium"
            >
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary" /> Gerar com IA
              </span>
              <span className="text-xs text-muted-foreground">{aiOpen ? 'Recolher' : 'Expandir'}</span>
            </button>
            {aiOpen && (
              <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
                <Textarea
                  value={briefing}
                  onChange={(e) => setBriefing(e.target.value)}
                  placeholder="Descreva o produto/serviço, diferenciais e público-alvo. Ex: Curso de Bombeiro Civil presencial em Curitiba, formação teórica e prática, público jovem 18-35 buscando nova profissão."
                  rows={3}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Select value={provider} onValueChange={(v) => setProvider(v as AiProvider)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AI_PROVIDER_OPTIONS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={model} onValueChange={setModel} disabled={loadingModels || models.length === 0}>
                    <SelectTrigger>
                      <SelectValue placeholder={loadingModels ? 'Carregando modelos...' : 'Selecione o modelo'} />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" onClick={handleGenerate} disabled={generating} className="w-full">
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Gerando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-1.5" /> Gerar títulos e descrições
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          <LimitedListEditor
            label="Títulos"
            items={headlines}
            onChange={setHeadlines}
            maxItems={MAX_HEADLINES}
            maxChars={MAX_HEADLINE_CHARS}
            placeholder="Ex: Curso de Bombeiro Civil"
          />
          <LimitedListEditor
            label="Descrições"
            items={descriptions}
            onChange={setDescriptions}
            maxItems={MAX_DESCRIPTIONS}
            maxChars={MAX_DESCRIPTION_CHARS}
            placeholder="Ex: Formação teórica e prática. Matrículas abertas, vagas limitadas."
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
