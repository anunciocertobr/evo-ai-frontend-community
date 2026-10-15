import { useEffect, useRef, useState } from 'react';
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
import { Loader2, Trash2, Upload } from 'lucide-react';
import {
  googleAdsCreationService,
  type ImageAssetEntry,
  type ImageAssetPayload,
  type GoogleAdsAsset,
} from '@/services/marketing/googleAdsCreationService';

const MAX_IMAGES = 20;

interface GoogleAdsImageAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  editing?: GoogleAdsAsset<ImageAssetPayload> | null;
}

export function GoogleAdsImageAssetDialog({ open, onOpenChange, onSaved, editing }: GoogleAdsImageAssetDialogProps) {
  const [name, setName] = useState('');
  const [images, setImages] = useState<ImageAssetEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setImages(editing?.payload.images ?? []);
  }, [open, editing]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      toast.error(`Máximo de ${MAX_IMAGES} imagens.`);
      return;
    }
    setUploading(true);
    try {
      const uploads = Array.from(files)
        .slice(0, remaining)
        .map(async (file) => {
          const fileUrl = await googleAdsCreationService.uploadImage(file);
          return { fileUrl, fileName: file.name };
        });
      const results = await Promise.allSettled(uploads);
      const ok = results.filter((r): r is PromiseFulfilledResult<ImageAssetEntry> => r.status === 'fulfilled').map((r) => r.value);
      const failed = results.length - ok.length;
      if (ok.length > 0) setImages((prev) => [...prev, ...ok]);
      if (failed > 0) toast.error(`${failed} imagem(ns) falharam no upload.`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Dê um nome pro conjunto de imagens.');
      return;
    }
    if (images.length === 0) {
      toast.error('Envie pelo menos uma imagem.');
      return;
    }
    setSaving(true);
    try {
      const payload: ImageAssetPayload = { images };
      if (editing) {
        await googleAdsCreationService.update(editing.id, name.trim(), payload);
        toast.success('Imagens atualizadas');
      } else {
        await googleAdsCreationService.create('image_asset', name.trim(), payload);
        toast.success('Imagens criadas');
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
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar imagens' : 'Novo conjunto de imagens'}</DialogTitle>
          <DialogDescription>
            Imagens pra exibir junto ao anúncio (Image Assets) — até {MAX_IMAGES} imagens. O Google Ads recomenda
            proporções 1:1, 1.91:1 e 4:5 pra cobrir todos os formatos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome do conjunto</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Imagens - Campanha Verão" />
          </div>

          <div className="space-y-1.5">
            <Label>
              Imagens ({images.length}/{MAX_IMAGES})
            </Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading || images.length >= MAX_IMAGES}>
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Enviando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-1.5" /> Enviar imagens
                </>
              )}
            </Button>

            {images.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center border border-dashed rounded-md">
                Nenhuma imagem ainda.
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-2">
                {images.map((img, index) => (
                  <div key={`${img.fileUrl}-${index}`} className="relative group">
                    <img src={img.fileUrl} alt={img.fileName} className="w-full aspect-square object-cover rounded-md border border-border" />
                    <button
                      type="button"
                      onClick={() => setImages((prev) => prev.filter((_, i) => i !== index))}
                      className="absolute top-1 right-1 bg-black/60 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3 text-white" />
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
          <Button onClick={handleSave} disabled={saving || uploading}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
