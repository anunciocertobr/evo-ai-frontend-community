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
} from '@evoapi/design-system';
import { Plus, Trash2 } from 'lucide-react';
import { googleAdsCreationService, type SitelinkEntry, type SitelinkPayload, type GoogleAdsAsset } from '@/services/marketing/googleAdsCreationService';

const MAX_SITELINKS = 10;
const MAX_LINK_TEXT_CHARS = 25;
const MAX_DESCRIPTION_CHARS = 35;

const emptyDraft: SitelinkEntry = { linkText: '', description1: '', description2: '', finalUrl: '' };

interface GoogleAdsSitelinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  editing?: GoogleAdsAsset<SitelinkPayload> | null;
}

export function GoogleAdsSitelinkDialog({ open, onOpenChange, onSaved, editing }: GoogleAdsSitelinkDialogProps) {
  const [name, setName] = useState('');
  const [sitelinks, setSitelinks] = useState<SitelinkEntry[]>([]);
  const [draft, setDraft] = useState<SitelinkEntry>(emptyDraft);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setSitelinks(editing?.payload.sitelinks ?? []);
    setDraft(emptyDraft);
  }, [open, editing]);

  const addSitelink = () => {
    if (!draft.linkText.trim() || !draft.finalUrl.trim()) {
      toast.error('Preencha ao menos o texto do link e a URL final.');
      return;
    }
    if (sitelinks.length >= MAX_SITELINKS) {
      toast.error(`Máximo de ${MAX_SITELINKS} sitelinks.`);
      return;
    }
    setSitelinks((prev) => [
      ...prev,
      {
        linkText: draft.linkText.trim(),
        description1: draft.description1?.trim() || undefined,
        description2: draft.description2?.trim() || undefined,
        finalUrl: draft.finalUrl.trim(),
      },
    ]);
    setDraft(emptyDraft);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Dê um nome pro conjunto de sitelinks.');
      return;
    }
    if (sitelinks.length < 2) {
      toast.error('O Google Ads exige pelo menos 2 sitelinks.');
      return;
    }
    setSaving(true);
    try {
      const payload: SitelinkPayload = { sitelinks };
      if (editing) {
        await googleAdsCreationService.update(editing.id, name.trim(), payload);
        toast.success('Sitelinks atualizados');
      } else {
        await googleAdsCreationService.create('sitelink', name.trim(), payload);
        toast.success('Sitelinks criados');
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
          <DialogTitle>{editing ? 'Editar sitelinks' : 'Novo conjunto de sitelinks'}</DialogTitle>
          <DialogDescription>
            Links extras abaixo do anúncio apontando pra páginas específicas do site — até {MAX_SITELINKS} sitelinks,
            com texto do link ({MAX_LINK_TEXT_CHARS} caracteres) e até 2 linhas de descrição ({MAX_DESCRIPTION_CHARS}{' '}
            caracteres cada).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome do conjunto</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Sitelinks - Institucional" />
          </div>

          <div className="space-y-2 border border-border rounded-lg p-3">
            <Label>Adicionar sitelink</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input
                value={draft.linkText}
                onChange={(e) => setDraft((d) => ({ ...d, linkText: e.target.value }))}
                placeholder="Texto do link (ex: Fale conosco)"
                maxLength={MAX_LINK_TEXT_CHARS}
              />
              <Input
                value={draft.finalUrl}
                onChange={(e) => setDraft((d) => ({ ...d, finalUrl: e.target.value }))}
                placeholder="URL final (https://...)"
              />
              <Input
                value={draft.description1}
                onChange={(e) => setDraft((d) => ({ ...d, description1: e.target.value }))}
                placeholder="Descrição linha 1 (opcional)"
                maxLength={MAX_DESCRIPTION_CHARS}
              />
              <Input
                value={draft.description2}
                onChange={(e) => setDraft((d) => ({ ...d, description2: e.target.value }))}
                placeholder="Descrição linha 2 (opcional)"
                maxLength={MAX_DESCRIPTION_CHARS}
              />
            </div>
            <Button type="button" variant="outline" onClick={addSitelink} disabled={sitelinks.length >= MAX_SITELINKS}>
              <Plus className="w-4 h-4 mr-1.5" /> Adicionar sitelink
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label>
              Sitelinks adicionados ({sitelinks.length}/{MAX_SITELINKS})
            </Label>
            {sitelinks.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center border border-dashed rounded-md">
                Nenhum sitelink ainda.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {sitelinks.map((sl, index) => (
                  <div key={`${sl.linkText}-${index}`} className="flex items-start justify-between gap-2 rounded-md border border-border px-3 py-1.5 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{sl.linkText}</p>
                      <p className="text-xs text-muted-foreground truncate">{sl.finalUrl}</p>
                      {(sl.description1 || sl.description2) && (
                        <p className="text-xs text-muted-foreground truncate">
                          {[sl.description1, sl.description2].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <button type="button" onClick={() => setSitelinks((prev) => prev.filter((_, i) => i !== index))} className="shrink-0">
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
