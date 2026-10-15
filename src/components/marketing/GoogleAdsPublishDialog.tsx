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
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@evoapi/design-system';
import { Loader2, Rocket } from 'lucide-react';
import { googleAdsCreationService, type GoogleAdsCampaignOption } from '@/services/marketing/googleAdsCreationService';

const ACCOUNT_LEVEL = '__account__';

interface GoogleAdsPublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetId: string;
  assetName: string;
  onPublished: () => void;
}

export function GoogleAdsPublishDialog({ open, onOpenChange, assetId, assetName, onPublished }: GoogleAdsPublishDialogProps) {
  const [campaigns, setCampaigns] = useState<GoogleAdsCampaignOption[] | null>(null);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(ACCOUNT_LEVEL);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedCampaign(ACCOUNT_LEVEL);
    setLoadingCampaigns(true);
    googleAdsCreationService
      .listCampaigns()
      .then(setCampaigns)
      .catch(() => toast.error('Não foi possível carregar as campanhas — você ainda pode publicar na conta inteira.'))
      .finally(() => setLoadingCampaigns(false));
  }, [open]);

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await googleAdsCreationService.publish(assetId, selectedCampaign === ACCOUNT_LEVEL ? undefined : selectedCampaign);
      toast.success('Publicado na Google Ads!');
      onPublished();
      onOpenChange(false);
    } catch (error) {
      const apiError = error as { response?: { data?: { errors?: string[] } } };
      toast.error(apiError?.response?.data?.errors?.[0] || 'Erro ao publicar na Google Ads.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Publicar "{assetName}" na Google Ads</DialogTitle>
          <DialogDescription>
            Escolha onde o item vai valer: numa campanha específica, ou na conta inteira (fica disponível pra todas
            as campanhas elegíveis).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>Onde publicar</Label>
          <Select value={selectedCampaign} onValueChange={setSelectedCampaign} disabled={loadingCampaigns}>
            <SelectTrigger>
              <SelectValue placeholder={loadingCampaigns ? 'Carregando campanhas...' : undefined} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ACCOUNT_LEVEL}>Toda a conta</SelectItem>
              {(campaigns || []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} {c.status !== 'ENABLED' ? `(${c.status})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handlePublish} disabled={publishing}>
            {publishing ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Publicando...
              </>
            ) : (
              <>
                <Rocket className="w-4 h-4 mr-1.5" /> Publicar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
