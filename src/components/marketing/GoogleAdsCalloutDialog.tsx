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
import { googleAdsCreationService, type CalloutPayload, type GoogleAdsAsset } from '@/services/marketing/googleAdsCreationService';

const MAX_CALLOUTS = 10;
const MAX_CALLOUT_CHARS = 25;

interface GoogleAdsCalloutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  editing?: GoogleAdsAsset<CalloutPayload> | null;
}

export function GoogleAdsCalloutDialog({ open, onOpenChange, onSaved, editing }: GoogleAdsCalloutDialogProps) {
  const [name, setName] = useState('');
  const [callouts, setCallouts] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setCallouts(editing?.payload.callouts ?? []);
    setDraft('');
  }, [open, editing]);

  const addCallout = () => {
    const value = draft.trim();
    if (!value) return;
    if (callouts.length >= MAX_CALLOUTS) {
      toast.error(`Máximo de ${MAX_CALLOUTS} frases de destaque.`);
      return;
    }
    if (value.length > MAX_CALLOUT_CHARS) {
      toast.error(`Máximo de ${MAX_CALLOUT_CHARS} caracteres.`);
      return;
    }
    setCallouts((prev) => [...prev, value]);
    setDraft('');
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Dê um nome pro conjunto de frases de destaque.');
      return;
    }
    if (callouts.length < 2) {
      toast.error('O Google Ads exige pelo menos 2 frases de destaque.');
      return;
    }
    setSaving(true);
    try {
      const payload: CalloutPayload = { callouts };
      if (editing) {
        await googleAdsCreationService.update(editing.id, name.trim(), payload);
        toast.success('Frases de destaque atualizadas');
      } else {
        await googleAdsCreationService.create('callout', name.trim(), payload);
        toast.success('Frases de destaque criadas');
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar frases de destaque' : 'Novas frases de destaque'}</DialogTitle>
          <DialogDescription>
            Frases curtas (callouts) que aparecem abaixo do anúncio destacando diferenciais — até {MAX_CALLOUTS}{' '}
            frases, {MAX_CALLOUT_CHARS} caracteres cada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome do conjunto</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Diferenciais - Geral" />
          </div>

          <div className="space-y-1.5">
            <Label>
              Frases de destaque ({callouts.length}/{MAX_CALLOUTS})
            </Label>
            <div className="flex gap-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ex: Entrega grátis"
                maxLength={MAX_CALLOUT_CHARS}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCallout();
                  }
                }}
              />
              <span className="text-xs text-muted-foreground self-center w-10 text-right shrink-0">
                {draft.length}/{MAX_CALLOUT_CHARS}
              </span>
              <Button type="button" variant="outline" size="icon" onClick={addCallout} disabled={callouts.length >= MAX_CALLOUTS}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-1.5">
              {callouts.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Nenhuma ainda.</p>
              ) : (
                callouts.map((item, index) => (
                  <div
                    key={`${item}-${index}`}
                    className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-1.5 text-sm"
                  >
                    <span className="truncate">{item}</span>
                    <button type="button" onClick={() => setCallouts((prev) => prev.filter((_, i) => i !== index))}>
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
