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
import { sitesService, type Site } from '@/services/sites/sitesService';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  site?: Site | null;
}

// Cria e edita Site no mesmo componente (igual LeadFormCreateDialog). No
// create, o backend busca o <title> da URL sozinho (Sites::TitleFetcherService)
// — mostramos "buscando nome..." enquanto espera, e o usuário pode ajustar
// antes de salvar de novo.
export function SiteCreateDialog({ open, onOpenChange, onSaved, site }: Props) {
  const isEditing = Boolean(site);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [fetchingName, setFetchingName] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUrl(site?.url || '');
    setName(site?.name || '');
  }, [open, site]);

  const handleSave = async () => {
    if (!url.trim()) {
      toast.error('Informe a URL do site.');
      return;
    }

    setSaving(true);
    try {
      if (isEditing && site) {
        await sitesService.update(site.id, { url, name: name || undefined });
        toast.success('Site atualizado!');
      } else {
        setFetchingName(true);
        await sitesService.create(url, name || undefined);
        toast.success('Site cadastrado!');
      }
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao salvar o site.');
    } finally {
      setSaving(false);
      setFetchingName(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar site' : 'Novo site'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Ajuste a URL ou o nome exibido no card.'
              : 'Buscamos o nome da página automaticamente (o mesmo que aparece na aba do navegador) — pode ajustar depois.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">URL do site</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://meusite.com.br" />
          </div>
          <div>
            <Label className="text-xs">Nome (opcional — buscado automaticamente se deixar em branco)</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={fetchingName ? 'Buscando nome do site...' : 'Nome do site'}
              disabled={fetchingName}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {fetchingName ? 'Buscando nome do site...' : saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
