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
} from '@evoapi/design-system';
import { metaCreationService, type CustomAudience, type MetaPixel } from '@/services/marketing/metaCreationService';

type AudienceType = 'site' | 'lookalike' | 'clientes';

interface AudienceCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adAccountId: string;
  existingAudiences: CustomAudience[];
  // Chamado só quando o tipo é "clientes" — a página-mãe abre o segundo
  // passo (escolher contatos) com o público recém-criado.
  onCustomerListCreated: (audience: CustomAudience) => void;
  onCreated: () => void;
}

export function AudienceCreateDialog({
  open,
  onOpenChange,
  adAccountId,
  existingAudiences,
  onCustomerListCreated,
  onCreated,
}: AudienceCreateDialogProps) {
  const [type, setType] = useState<AudienceType>('site');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Site (Pixel)
  const [pixels, setPixels] = useState<MetaPixel[] | null>(null);
  const [pixelId, setPixelId] = useState('');
  const [retentionDays, setRetentionDays] = useState(30);
  const [urlContains, setUrlContains] = useState('');

  // Lookalike
  const [originAudienceId, setOriginAudienceId] = useState('');
  const [country, setCountry] = useState('BR');
  const [ratio, setRatio] = useState(1);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || type !== 'site' || pixels !== null) return;
    metaCreationService
      .listPixels(adAccountId)
      .then(setPixels)
      .catch(() => toast.error('Erro ao carregar pixels da conta'));
  }, [open, type, pixels, adAccountId]);

  const reset = () => {
    setType('site');
    setName('');
    setDescription('');
    setPixels(null);
    setPixelId('');
    setRetentionDays(30);
    setUrlContains('');
    setOriginAudienceId('');
    setCountry('BR');
    setRatio(1);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Informe o nome do público');
      return;
    }
    setSaving(true);
    try {
      if (type === 'site') {
        if (!pixelId) {
          toast.error('Selecione o pixel');
          setSaving(false);
          return;
        }
        await metaCreationService.createWebsiteAudience({
          adAccountId,
          name: name.trim(),
          pixelId,
          retentionDays,
          urlContains: urlContains.trim() || undefined,
          description: description.trim() || undefined,
        });
        toast.success('Público de site criado na Meta!');
        reset();
        onOpenChange(false);
        onCreated();
      } else if (type === 'lookalike') {
        if (!originAudienceId) {
          toast.error('Selecione o público de origem');
          setSaving(false);
          return;
        }
        await metaCreationService.createLookalikeAudience({
          adAccountId,
          name: name.trim(),
          originAudienceId,
          country,
          ratio: ratio / 100,
        });
        toast.success('Público semelhante criado na Meta!');
        reset();
        onOpenChange(false);
        onCreated();
      } else {
        const audience = await metaCreationService.createCustomerListAudience({
          adAccountId,
          name: name.trim(),
          description: description.trim() || undefined,
        });
        reset();
        onOpenChange(false);
        onCustomerListCreated(audience);
      }
    } catch {
      toast.error('Erro ao criar o público na Meta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo público</DialogTitle>
          <DialogDescription>Cria um Custom Audience na conta de anúncio selecionada.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Tipo de público</Label>
            <Select value={type} onValueChange={(v) => setType(v as AudienceType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="site">Site (Pixel)</SelectItem>
                <SelectItem value="lookalike">Semelhante (Lookalike)</SelectItem>
                <SelectItem value="clientes">Lista de clientes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do público" />
          </div>

          <div className="space-y-1.5">
            <Label>Descrição (opcional)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          {type === 'site' && (
            <>
              <div className="space-y-1.5">
                <Label>Pixel</Label>
                <Select value={pixelId} onValueChange={setPixelId}>
                  <SelectTrigger>
                    <SelectValue placeholder={pixels === null ? 'Carregando...' : 'Selecione o pixel'} />
                  </SelectTrigger>
                  <SelectContent>
                    {(pixels || []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {pixels?.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum pixel encontrado nesta conta.</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Retenção (dias)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={180}
                    value={retentionDays}
                    onChange={(e) => setRetentionDays(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>URL contém (opcional)</Label>
                  <Input value={urlContains} onChange={(e) => setUrlContains(e.target.value)} placeholder="/imoveis" />
                </div>
              </div>
            </>
          )}

          {type === 'lookalike' && (
            <>
              <div className="space-y-1.5">
                <Label>Público de origem</Label>
                <Select value={originAudienceId} onValueChange={setOriginAudienceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um público já existente" />
                  </SelectTrigger>
                  <SelectContent>
                    {existingAudiences
                      .filter((a) => a.subtype !== 'LOOKALIKE')
                      .map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>País</Label>
                  <Input value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} maxLength={2} />
                </div>
                <div className="space-y-1.5">
                  <Label>Tamanho (%)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={ratio}
                    onChange={(e) => setRatio(Number(e.target.value))}
                  />
                </div>
              </div>
            </>
          )}

          {type === 'clientes' && (
            <p className="text-xs text-muted-foreground">
              Depois de criar, você escolhe quais contatos do CRM entram nesse público.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Criando...' : 'Criar público'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
