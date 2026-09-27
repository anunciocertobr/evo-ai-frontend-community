import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ChevronLeft } from 'lucide-react';
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
import { MetaScopedEntityPicker } from '@/components/marketing/MetaScopedEntityPicker';
import { clientGoalsService } from '@/services/marketing/clientGoalsService';

type AudienceType = 'site' | 'lookalike' | 'clientes';

const SUBTYPE_TO_TYPE: Record<string, AudienceType> = {
  WEBSITE: 'site',
  LOOKALIKE: 'lookalike',
  CUSTOM: 'clientes',
};

interface AudienceCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  adAccountId: string;
  existingAudiences: CustomAudience[];
  // Chamado só quando o tipo é "clientes" — a página-mãe abre o segundo
  // passo (escolher contatos) com o público recém-criado.
  onCustomerListCreated: (audience: CustomAudience) => void;
  onCreated: () => void;
  // Presente = modo "Duplicar pra outra conta": primeiro escolhe a conta de
  // destino (BM > Conta, nunca a mesma automaticamente — pixel e público de
  // origem são por conta), só depois mostra o resto do formulário
  // pré-preenchido a partir deste público.
  duplicateFrom?: CustomAudience | null;
  // Nome da conta onde o público foi listado — o passo 1 do duplicar mostra
  // "Mesma conta (nome)" como atalho, sem obrigar a navegar BM > Conta de novo.
  currentAccountName?: string | null;
}

export function AudienceCreateDialog({
  open,
  onOpenChange,
  adAccountId,
  existingAudiences,
  onCustomerListCreated,
  onCreated,
  duplicateFrom,
  currentAccountName,
}: AudienceCreateDialogProps) {
  const isDuplicate = Boolean(duplicateFrom);

  const [targetAccount, setTargetAccount] = useState<{ id: string; name: string } | null>(null);
  // null = ainda não escolheu (mostra a pergunta "mesma conta ou outra?");
  // 'mesma'/'outra' = resposta do passo 1.
  const [targetChoice, setTargetChoice] = useState<'mesma' | 'outra' | null>(null);
  const [targetAudiences, setTargetAudiences] = useState<CustomAudience[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

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

  // Conta efetiva usada pra listar pixels/públicos de origem e pra criar:
  // a própria (fluxo normal) ou a conta de destino escolhida (duplicar).
  const effectiveAccountId = isDuplicate ? targetAccount?.id : adAccountId;
  const originAudienceOptions = isDuplicate ? targetAudiences : existingAudiences;

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
    setTargetAccount(null);
    setTargetChoice(null);
    setTargetAudiences([]);
  };

  // Ao abrir em modo duplicar, pré-preenche tipo/nome/descrição direto (não
  // dependem da conta de destino); o resto (pixel/público de origem/
  // retenção/país/tamanho) só é carregado depois que a conta de destino é
  // escolhida, porque pixel e público de origem são específicos da conta.
  useEffect(() => {
    if (!open || !duplicateFrom) return;
    setType(SUBTYPE_TO_TYPE[duplicateFrom.subtype] || 'site');
    setName(`${duplicateFrom.name} - Cópia`);
    setDescription(duplicateFrom.description || '');
  }, [open, duplicateFrom]);

  // Depois de escolher a conta de destino: busca detalhe do público de
  // origem (retention_days/lookalike_spec) e a lista de pixels/públicos JÁ
  // DA CONTA DE DESTINO — nunca reaproveita ids da conta de origem.
  useEffect(() => {
    if (!isDuplicate || !targetAccount || !duplicateFrom) return;
    setLoadingDetail(true);
    Promise.all([
      metaCreationService.getAudienceDetail(duplicateFrom.id).catch(() => null),
      metaCreationService.listPixels(targetAccount.id).catch(() => []),
      metaCreationService.listAudiences(targetAccount.id).catch(() => []),
    ])
      .then(([detail, pixelList, audienceList]) => {
        if (detail?.retention_days) setRetentionDays(detail.retention_days);
        if (detail?.lookalike_spec?.country) setCountry(detail.lookalike_spec.country);
        if (detail?.lookalike_spec?.ratio) setRatio(Math.round(detail.lookalike_spec.ratio * 100));
        setPixels(pixelList);
        setTargetAudiences(audienceList);
      })
      .finally(() => setLoadingDetail(false));
  }, [isDuplicate, targetAccount, duplicateFrom]);

  useEffect(() => {
    if (isDuplicate || !open || type !== 'site' || pixels !== null) return;
    metaCreationService
      .listPixels(adAccountId)
      .then(setPixels)
      .catch(() => toast.error('Erro ao carregar pixels da conta'));
  }, [isDuplicate, open, type, pixels, adAccountId]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Informe o nome do público');
      return;
    }
    if (!effectiveAccountId) {
      toast.error('Selecione a conta de destino');
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
          adAccountId: effectiveAccountId,
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
          adAccountId: effectiveAccountId,
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
          adAccountId: effectiveAccountId,
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className={isDuplicate ? 'sm:max-w-2xl' : 'sm:max-w-lg'}>
        <DialogHeader>
          <DialogTitle>{isDuplicate ? 'Duplicar público' : 'Novo público'}</DialogTitle>
          <DialogDescription>
            {isDuplicate
              ? 'Escolha se a cópia vai para a mesma conta ou para outra conta de anúncio.'
              : 'Cria um Custom Audience na conta de anúncio selecionada.'}
          </DialogDescription>
        </DialogHeader>

        {isDuplicate && !targetAccount && !targetChoice ? (
          /* Passo 1 — pergunta antes de qualquer coisa: mesma conta ou outra? */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setTargetChoice('mesma');
                setTargetAccount({ id: adAccountId, name: currentAccountName || 'Conta atual' });
              }}
              className="text-left rounded-lg border border-border bg-card p-4 space-y-1 hover:border-primary/50 hover:bg-muted/40 transition-colors"
            >
              <h4 className="text-sm font-semibold break-words">Mesma conta</h4>
              <p className="text-xs text-muted-foreground break-words">
                {currentAccountName || 'A conta onde você está agora'}
              </p>
            </button>
            <button
              type="button"
              onClick={() => setTargetChoice('outra')}
              className="text-left rounded-lg border border-border bg-card p-4 space-y-1 hover:border-primary/50 hover:bg-muted/40 transition-colors"
            >
              <h4 className="text-sm font-semibold break-words">Outra conta</h4>
              <p className="text-xs text-muted-foreground">Escolher a conta de destino (BM &gt; Conta de anúncio)</p>
            </button>
          </div>
        ) : isDuplicate && !targetAccount ? (
          <div className="space-y-3">
            <Button variant="ghost" size="sm" onClick={() => setTargetChoice(null)}>
              <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Voltar
            </Button>
            <MetaScopedEntityPicker
              compact
              stepTwoLabel="Conta de anúncio"
              fetchStepTwo={(bmId) => clientGoalsService.listAdAccountsForBm(bmId)}
              onSelect={setTargetAccount}
            />
          </div>
        ) : (
          <div className="space-y-3">
            {isDuplicate && targetAccount && (
              <div className="flex items-start justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                <span className="text-sm min-w-0 break-words">
                  Conta de destino: <span className="font-medium">{targetAccount.name}</span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    setTargetAccount(null);
                    setTargetChoice(null);
                  }}
                >
                  Trocar
                </Button>
              </div>
            )}

            {loadingDetail ? (
              <p className="text-sm text-muted-foreground text-center py-6">Carregando dados da conta de destino...</p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Tipo de público</Label>
                  <Select value={type} onValueChange={(v) => setType(v as AudienceType)} disabled={isDuplicate}>
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
                    {isDuplicate && (
                      <p className="text-xs text-muted-foreground">
                        A regra de URL do público de origem não é copiada automaticamente — confira/ajuste acima.
                      </p>
                    )}
                  </>
                )}

                {type === 'lookalike' && (
                  <>
                    <div className="space-y-1.5">
                      <Label>Público de origem {isDuplicate && '(da conta de destino)'}</Label>
                      <Select value={originAudienceId} onValueChange={setOriginAudienceId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um público já existente" />
                        </SelectTrigger>
                        <SelectContent>
                          {originAudienceOptions
                            .filter((a) => a.subtype !== 'LOOKALIKE')
                            .map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      {isDuplicate && originAudienceOptions.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          A conta de destino ainda não tem nenhum público pra usar como origem — crie um lá primeiro.
                        </p>
                      )}
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
                    Depois de criar, você escolhe quais contatos do CRM entram nesse público
                    {isDuplicate && ' — os contatos do público de origem não são copiados automaticamente'}.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          {(!isDuplicate || targetAccount) && (
            <Button onClick={handleSubmit} disabled={saving || loadingDetail}>
              {saving ? 'Criando...' : isDuplicate ? 'Criar cópia' : 'Criar público'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
