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
import { googleAdsCreationService, type CallPayload, type GoogleAdsAsset } from '@/services/marketing/googleAdsCreationService';

interface GoogleAdsCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  editing?: GoogleAdsAsset<CallPayload> | null;
}

export function GoogleAdsCallDialog({ open, onOpenChange, onSaved, editing }: GoogleAdsCallDialogProps) {
  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState('BR');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setCountryCode(editing?.payload.countryCode ?? 'BR');
    setPhoneNumber(editing?.payload.phoneNumber ?? '');
  }, [open, editing]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Dê um nome pra extensão de chamada.');
      return;
    }
    if (!phoneNumber.trim()) {
      toast.error('Informe o número de telefone.');
      return;
    }
    setSaving(true);
    try {
      const payload: CallPayload = { countryCode: countryCode.trim().toUpperCase(), phoneNumber: phoneNumber.trim() };
      if (editing) {
        await googleAdsCreationService.update(editing.id, name.trim(), payload);
        toast.success('Extensão de chamada atualizada');
      } else {
        await googleAdsCreationService.create('call', name.trim(), payload);
        toast.success('Extensão de chamada criada');
      }
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao salvar — confira se já não existe uma extensão com esse nome.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar extensão de chamada' : 'Nova extensão de chamada'}</DialogTitle>
          <DialogDescription>
            Número de telefone exibido junto ao anúncio (ou usado pra uma ligação direta no celular).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome da extensão</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Telefone - Comercial" />
          </div>
          <div className="grid grid-cols-[5rem_1fr] gap-2">
            <div className="space-y-1.5">
              <Label>País</Label>
              <Input value={countryCode} onChange={(e) => setCountryCode(e.target.value)} placeholder="BR" maxLength={2} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="(11) 91234-5678" />
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
