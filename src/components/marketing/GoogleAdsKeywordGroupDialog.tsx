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
  Switch,
  Textarea,
} from '@evoapi/design-system';
import { Plus, Trash2, Sparkles, Loader2 } from 'lucide-react';
import {
  googleAdsCreationService,
  type KeywordEntry,
  type KeywordGroupPayload,
  type KeywordMatchType,
  type GoogleAdsAsset,
} from '@/services/marketing/googleAdsCreationService';
import {
  AI_PROVIDER_OPTIONS,
  generateText,
  listAiModels,
  type AiModelOption,
  type AiProvider,
} from '@/services/marketing/aiTextService';

const MAX_AI_KEYWORDS = 20;
const MAX_AI_NEGATIVES = 10;

const MATCH_TYPE_LABEL: Record<KeywordMatchType, string> = {
  broad: 'Ampla',
  phrase: 'Frase',
  exact: 'Exata',
};

const MATCH_TYPE_HINT: Record<KeywordMatchType, string> = {
  broad: 'palavra chave',
  phrase: '"palavra chave"',
  exact: '[palavra chave]',
};

interface GoogleAdsKeywordGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  editing?: GoogleAdsAsset<KeywordGroupPayload> | null;
}

export function GoogleAdsKeywordGroupDialog({
  open,
  onOpenChange,
  onSaved,
  editing,
}: GoogleAdsKeywordGroupDialogProps) {
  const [name, setName] = useState('');
  const [adGroupName, setAdGroupName] = useState('');
  const [keywords, setKeywords] = useState<KeywordEntry[]>([]);
  const [draftText, setDraftText] = useState('');
  const [draftMatch, setDraftMatch] = useState<KeywordMatchType>('phrase');
  const [draftNegative, setDraftNegative] = useState(false);
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
    setAdGroupName(editing?.payload.adGroupName ?? '');
    setKeywords(editing?.payload.keywords ?? []);
    setDraftText('');
    setDraftMatch('phrase');
    setDraftNegative(false);
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
      toast.error('Descreva o produto/serviço e o público pra IA sugerir palavras-chave.');
      return;
    }
    if (!model) {
      toast.error('Selecione um modelo de IA.');
      return;
    }
    setGenerating(true);
    try {
      const prompt = `Você é um especialista em Google Ads. Com base neste briefing:\n"""${briefing.trim()}"""\n\nSugira até ${MAX_AI_KEYWORDS} palavras-chave positivas (com o tipo de correspondência mais adequado: broad, phrase ou exact) e até ${MAX_AI_NEGATIVES} palavras-chave negativas (termos que trazem tráfego irrelevante e devem ser excluídos). Responda SOMENTE em JSON válido, sem markdown, no formato exato: {"keywords": [{"text": "...", "matchType": "phrase"}], "negatives": ["...", "..."]}`;
      const raw = await generateText(provider, model, prompt);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('formato inesperado');
      const parsed = JSON.parse(jsonMatch[0]) as {
        keywords?: { text?: string; matchType?: string }[];
        negatives?: string[];
      };

      const existingTexts = new Set(keywords.map((k) => `${k.text.toLowerCase()}|${k.negative}`));
      const validMatchTypes: KeywordMatchType[] = ['broad', 'phrase', 'exact'];

      const newPositive: KeywordEntry[] = (parsed.keywords || [])
        .filter((k): k is { text: string; matchType?: string } => Boolean(k.text?.trim()))
        .map((k) => ({
          text: k.text.trim(),
          matchType: validMatchTypes.includes(k.matchType as KeywordMatchType)
            ? (k.matchType as KeywordMatchType)
            : 'phrase',
          negative: false,
        }))
        .filter((k) => !existingTexts.has(`${k.text.toLowerCase()}|false`));

      const newNegative: KeywordEntry[] = (parsed.negatives || [])
        .filter((text): text is string => Boolean(text?.trim()))
        .map((text) => ({ text: text.trim(), matchType: 'phrase' as KeywordMatchType, negative: true }))
        .filter((k) => !existingTexts.has(`${k.text.toLowerCase()}|true`));

      if (newPositive.length === 0 && newNegative.length === 0) {
        toast.error('A IA não retornou nenhuma palavra-chave nova.');
        return;
      }

      setKeywords((prev) => [...prev, ...newPositive, ...newNegative]);
      toast.success(`${newPositive.length} palavra(s)-chave e ${newNegative.length} negativa(s) adicionadas`);
    } catch {
      toast.error('Erro ao gerar com IA — tente outro modelo ou ajuste o briefing.');
    } finally {
      setGenerating(false);
    }
  };

  const addKeyword = () => {
    const text = draftText.trim();
    if (!text) return;
    setKeywords((prev) => [...prev, { text, matchType: draftMatch, negative: draftNegative }]);
    setDraftText('');
  };

  const removeKeyword = (index: number) => {
    setKeywords((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Dê um nome pro grupo de palavras-chave.');
      return;
    }
    if (keywords.length === 0) {
      toast.error('Adicione ao menos uma palavra-chave.');
      return;
    }
    setSaving(true);
    try {
      const payload: KeywordGroupPayload = { adGroupName: adGroupName.trim() || undefined, keywords };
      if (editing) {
        await googleAdsCreationService.update(editing.id, name.trim(), payload);
        toast.success('Grupo de palavras-chave atualizado');
      } else {
        await googleAdsCreationService.create('keyword_group', name.trim(), payload);
        toast.success('Grupo de palavras-chave criado');
      }
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao salvar — confira se já não existe um grupo com esse nome.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar grupo de palavras-chave' : 'Novo grupo de palavras-chave'}</DialogTitle>
          <DialogDescription>
            Monte a lista de palavras-chave (com tipo de correspondência) e as negativas pra excluir buscas
            irrelevantes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nome do grupo</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Bombeiro Civil - Geral" />
            </div>
            <div className="space-y-1.5">
              <Label>Nome do grupo de anúncios (opcional)</Label>
              <Input
                value={adGroupName}
                onChange={(e) => setAdGroupName(e.target.value)}
                placeholder="Ex: AG - Bombeiro Civil"
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
                <Sparkles className="w-4 h-4 text-primary" /> Gerar palavras-chave com IA
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
                      <Sparkles className="w-4 h-4 mr-1.5" /> Gerar palavras-chave e negativas
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-1.5 border border-border rounded-lg p-3">
            <Label>Adicionar palavra-chave manualmente</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                placeholder="Ex: curso de bombeiro civil"
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addKeyword();
                  }
                }}
              />
              <Select value={draftMatch} onValueChange={(v) => setDraftMatch(v as KeywordMatchType)}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(MATCH_TYPE_LABEL) as KeywordMatchType[]).map((mt) => (
                    <SelectItem key={mt} value={mt}>
                      {MATCH_TYPE_LABEL[mt]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1.5 shrink-0">
                <Switch checked={draftNegative} onCheckedChange={setDraftNegative} id="negative-switch" />
                <Label htmlFor="negative-switch" className="text-xs font-normal">
                  Negativa
                </Label>
              </div>
              <Button type="button" variant="outline" size="icon" onClick={addKeyword} className="shrink-0">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Prévia: {MATCH_TYPE_HINT[draftMatch]}</p>
          </div>

          <div className="space-y-1.5">
            <Label>Palavras-chave adicionadas ({keywords.length})</Label>
            {keywords.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center border border-dashed rounded-md">
                Nenhuma palavra-chave ainda.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {keywords.map((kw, index) => (
                  <div
                    key={`${kw.text}-${index}`}
                    className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-1.5 text-sm"
                  >
                    <span className={kw.negative ? 'text-rose-500' : ''}>
                      {kw.negative ? '− ' : ''}
                      {MATCH_TYPE_HINT[kw.matchType].replace('palavra chave', kw.text)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{MATCH_TYPE_LABEL[kw.matchType]}</span>
                      <button type="button" onClick={() => removeKeyword(index)}>
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-rose-500" />
                      </button>
                    </div>
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
