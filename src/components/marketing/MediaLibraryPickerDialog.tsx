import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@evoapi/design-system';
import { MediaLibraryBrowser } from '@/components/marketing/MediaLibraryBrowser';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (file: File) => void;
}

export function MediaLibraryPickerDialog({ open, onOpenChange, onPick }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Biblioteca de mídias</DialogTitle>
          <DialogDescription>Escolha uma imagem ou vídeo do Google Drive ou do Dropbox para usar no anúncio.</DialogDescription>
        </DialogHeader>
        <MediaLibraryBrowser
          mode="pick"
          onPick={(file) => {
            onPick(file);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
