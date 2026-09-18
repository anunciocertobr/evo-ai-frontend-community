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
} from '@evoapi/design-system';
import { Plus, Trash2 } from 'lucide-react';
import {
  googleAdsCreationService,
  type KeywordEntry,
  type KeywordGroupPayload,
  type KeywordMatchType,
  type GoogleAdsAsset,
} from '@/services/marketing/googleAdsCreationService';

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

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setAdGroupName(editing?.payload.adGroupName ?? '');
    setKeywords(editing?.payload.keywords ?? []);
    setDraftText('');
    setDraftMatch('phrase');
    setDraftNegative(false);
  }, [open, editing]);

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

          <div className="space-y-1.5 border border-border rounded-lg p-3">
            <Label>Adicionar palavra-chave</Label>
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
