import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ExternalLink } from 'lucide-react';
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
import {
  metaCreationService,
  META_APP_EVENTS,
  META_ENGAGEMENT_EVENTS,
  META_INSTAGRAM_EVENTS,
  type CustomAudience,
  type MetaPageRef,
  type MetaPixel,
} from '@/services/marketing/metaCreationService';
import { MetaScopedEntityPicker } from '@/components/marketing/MetaScopedEntityPicker';
import { suggestCopyName } from '@/components/marketing/audienceNaming';
import {
  clampRetention,
  extractVideoId,
  parseAudienceDetail,
  type AudienceKind,
} from '@/components/marketing/audienceDetail';
import { clientGoalsService } from '@/services/marketing/clientGoalsService';

type LookalikeSource = 'audience' | 'site' | 'engagement' | 'instagram' | 'app';

const KIND_LABEL: Record<AudienceKind, string> = {
  site: 'Site (Pixel)',
  engagement: 'Facebook Page (engajamento)',
  instagram: 'Instagram (perfil profissional)',
  video: 'Vídeo',
  app: 'Atividade no app',
  clientes: 'Lista de clientes',
  lookalike: 'Semelhante (Lookalike)',
  salvo: 'Público salvo (direcionamento)',
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
  // Presente = modo "Duplicar": primeiro escolhe a conta de destino (mesma ou
  // outra) e só depois mostra o formulário preenchido com o que o público de
  // origem realmente é.
  duplicateFrom?: CustomAudience | null;
  // Nome da conta onde o público foi listado — o passo 1 do duplicar mostra
  // "Mesma conta (nome)" como atalho, sem obrigar a navegar BM > Conta de novo.
  currentAccountName?: string | null;
  // Abre a aba de público salvo (direcionamento detalhado) — usado pelo aviso
  // quando o público de origem é um "público salvo".
  onGoToSavedAudience?: () => void;
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
  onGoToSavedAudience,
}: AudienceCreateDialogProps) {
  const isDuplicate = Boolean(duplicateFrom);

  const [targetAccount, setTargetAccount] = useState<{ id: string; name: string } | null>(null);
  // null = ainda não escolheu (mostra a pergunta "mesma conta ou outra?");
  // 'mesma'/'outra' = resposta do passo 1.
  const [targetChoice, setTargetChoice] = useState<'mesma' | 'outra' | null>(null);
  const [targetAudiences, setTargetAudiences] = useState<CustomAudience[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [kind, setKind] = useState<AudienceKind>('site');
  const [name, setName] = useState('');
  // Se o usuário editar o nome, paramos de recalcular o sufixo "- Cópia".
  const [nameTouched, setNameTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [note, setNote] = useState<string | undefined>(undefined);

  const [retentionDays, setRetentionDays] = useState(30);
  const [urlContains, setUrlContains] = useState('');
  const [pixelId, setPixelId] = useState('');
  const [videoId, setVideoId] = useState('');
  const [videoInput, setVideoInput] = useState('');
  const [pageId, setPageId] = useState('');
  const [igUserId, setIgUserId] = useState('');
  const [appId, setAppId] = useState('');
  const [engagementEvent, setEngagementEvent] = useState('page_engaged');
  const [appEvent, setAppEvent] = useState('any');
  const [lookalikeSource, setLookalikeSource] = useState<LookalikeSource>('audience');
  const [originAudienceId, setOriginAudienceId] = useState('');
  const [country, setCountry] = useState('BR');
  const [ratio, setRatio] = useState(1);
  const [lookalikeType, setLookalikeType] = useState<'similarity' | 'reach'>('similarity');

  const [pixels, setPixels] = useState<MetaPixel[] | null>(null);
  const [pages, setPages] = useState<MetaPageRef[] | null>(null);
  const [igName, setIgName] = useState('');
  const [saving, setSaving] = useState(false);

  // Conta efetiva usada pra listar pixels/páginas/públicos de origem e pra
  // criar: a própria (fluxo normal) ou a conta de destino escolhida (duplicar).
  const effectiveAccountId = isDuplicate ? targetAccount?.id : adAccountId;
  const originAudienceOptions = isDuplicate ? targetAudiences : existingAudiences;

  // Site/pixel é limitado a 180 dias de retenção; os demais tipos vão a 365.
  const retentionMax =
    kind === 'site' || (kind === 'lookalike' && lookalikeSource === 'site') ? 180 : 365;

  // Monta a regra (rule) no mesmo formato que a Graph API espera — é o que
  // serve tanto pro público de site quanto pro source_spec de um semelhante.
  const buildRule = (source: {
    type: 'pixel' | 'page' | 'app';
    id: string;
    filter: Record<string, string>;
  }): Record<string, unknown> => ({
    inclusions: {
      operator: 'or',
      rules: [
        {
          event_sources: [{ id: String(source.id), type: source.type }],
          retention_seconds: clampRetention(retentionDays, retentionMax) * 86_400,
          filter: { operator: 'and', filters: [source.filter] },
        },
      ],
    },
  });

  const siteFilter = () =>
    urlContains.trim()
      ? { field: 'url', operator: 'i_contains', value: urlContains.trim() }
      : { field: 'event', operator: 'eq', value: 'PageView' };

  // Semelhante pode vir de um público que já existe na conta (qualquer tipo,
  // inclusive público salvo) ou direto de uma fonte (site/página/Instagram/
  // app) via source_spec — não dá pra fazer "semelhante de vídeo" por
  // source_spec, então nesse caso o usuário escolhe o público de vídeo como
  // semente.
  const buildLookalikeSourceSpec = (): Record<string, unknown> | undefined => {
    if (lookalikeSource === 'audience') return undefined;
    if (lookalikeSource === 'site' && pixelId) {
      return buildRule({ type: 'pixel', id: pixelId, filter: siteFilter() });
    }
    if (lookalikeSource === 'engagement' && pageId) {
      return buildRule({ type: 'page', id: pageId, filter: { field: 'event', operator: 'eq', value: engagementEvent } });
    }
    if (lookalikeSource === 'instagram' && igUserId) {
      return buildRule({
        type: 'page',
        id: igUserId,
        filter: { field: 'event', operator: 'eq', value: engagementEvent },
      });
    }
    if (lookalikeSource === 'app' && appId) {
      return buildRule({ type: 'app', id: appId, filter: { field: 'event', operator: 'eq', value: appEvent } });
    }
    return undefined;
  };

  const reset = () => {
    setKind('site');
    setName('');
    setNameTouched(false);
    setDescription('');
    setNote(undefined);
    setRetentionDays(30);
    setUrlContains('');
    setPixelId('');
    setVideoId('');
    setVideoInput('');
    setPageId('');
    setIgUserId('');
    setAppId('');
    setEngagementEvent('page_engaged');
    setAppEvent('any');
    setLookalikeSource('audience');
    setOriginAudienceId('');
    setCountry('BR');
    setRatio(1);
    setLookalikeType('similarity');
    setPixels(null);
    setPages(null);
    setIgName('');
    setTargetAccount(null);
    setTargetChoice(null);
    setTargetAudiences([]);
  };

  // Ao abrir em modo duplicar já leva a descrição do público de origem. O
  // TIPO real só pode vir do detalhe (a listagem não traz `rule`), então ele é
  // preenchido quando a conta de destino é escolhida. O nome é recalculado
  // depois, quando a lista de públicos da conta de destino souber se o mesmo
  // nome já existe lá.
  useEffect(() => {
    if (!open || !duplicateFrom) return;
    setDescription(duplicateFrom.description || '');
    setNameTouched(false);
  }, [open, duplicateFrom]);

  // Depois de escolher a conta de destino: lê o detalhe REAL do público de
  // origem (tipo/regra/retensão/lookalike) e carrega pixels, páginas e
  // públicos JÁ DA CONTA DE DESTINO — nunca reaproveita ids da conta de
  // origem (pixel e público de semente são por conta).
  useEffect(() => {
    if (!isDuplicate || !targetAccount || !duplicateFrom) return;
    setLoadingDetail(true);
    Promise.all([
      metaCreationService.getAudienceDetail(duplicateFrom.id).catch(() => null),
      metaCreationService.listPixels(targetAccount.id).catch(() => [] as MetaPixel[]),
      metaCreationService.listAudiences(targetAccount.id).catch(() => [] as CustomAudience[]),
      metaCreationService.listPagesForAdAccount(targetAccount.id).catch(() => [] as MetaPageRef[]),
    ])
      .then(async ([detail, pixelList, audienceList, pageList]) => {
        setPixels(pixelList);
        setTargetAudiences(audienceList);
        setPages(pageList);
        if (!detail) {
          setNote('Não foi possível ler o público de origem na Meta — confira os campos antes de criar.');
          return;
        }

        const parsed = parseAudienceDetail(detail);
        setKind(parsed.kind);
        setRetentionDays(parsed.retentionDays);
        setUrlContains(parsed.urlContains);
        setEngagementEvent(parsed.engagementEvent);
        setAppEvent(parsed.appEvent);
        setCountry(parsed.country);
        setRatio(parsed.ratio);
        setLookalikeType(parsed.lookalikeType);

        // Pixel e Página são por business/conta: o id lido na origem só vale na
        // conta de destino se existir lá também. Mantemos quando existe e
        // avisamos pra escolher quando não — evita um campo de select vazio sem
        // explicação.
        const missing: string[] = [];
        const destinationPixel = pixelList.find((p) => p.id === parsed.pixelId);
        if (parsed.pixelId && destinationPixel) setPixelId(destinationPixel.id);
        else if (parsed.pixelId) {
          setPixelId('');
          missing.push('o pixel');
        }

        const destinationPage = pageList.find((p) => p.id === parsed.pageId || p.id === parsed.igUserId);
        if (destinationPage) {
          setPageId(destinationPage.id);
          if (parsed.igUserId) setIgUserId(destinationPage.id);
        } else {
          if (parsed.pageId) missing.push('a página');
          setPageId('');
          setIgUserId('');
        }

        // Vídeo e app têm id global (o mesmo vídeo/app em qualquer conta), então
        // são reaproveitados direto.
        setVideoId(parsed.videoId);
        setVideoInput(parsed.videoId);
        setAppId(parsed.appId);

        setNote(
          missing.length
            ? `Copiado da conta de origem, mas ${missing.join(' e ')} não existe na conta de destino — escolha abaixo.`
            : parsed.note,
        );

        // Semelhante: tenta casar o público de origem pelo nome na conta de
        // destino (o id é sempre diferente entre contas).
        if (parsed.kind === 'lookalike' && parsed.originAudienceId) {
          const originName = await metaCreationService
            .getAudienceName(parsed.originAudienceId)
            .then((r) => r?.name)
            .catch(() => null);
          const match = originName
            ? audienceList.find((a) => a.name.trim().toLowerCase() === originName.trim().toLowerCase())
            : null;
          setLookalikeSource('audience');
          setOriginAudienceId(match ? match.id : '');
          if (originName && !match) {
            setNote(
              `A conta de destino não tem nenhum público chamado "${originName}" — escolha qual público será a origem do semelhante.`,
            );
          }
        }
      })
      .finally(() => setLoadingDetail(false));
  }, [isDuplicate, targetAccount, duplicateFrom]);

  // Nome da cópia: mesmo nome do original, com sufixo só em caso de conflito
  // real na conta de destino (e nunca sobrescrevendo o que o usuário digitou).
  useEffect(() => {
    if (!isDuplicate || !duplicateFrom || nameTouched) return;
    const destination = isDuplicate && targetAccount ? targetAudiences : existingAudiences;
    if (isDuplicate && !targetAccount) {
      setName(duplicateFrom.name);
      return;
    }
    setName(suggestCopyName(duplicateFrom.name, destination.map((a) => a.name)));
  }, [isDuplicate, duplicateFrom, targetAccount, targetAudiences, existingAudiences, nameTouched]);

  // Pixels: só interessam a site (e a "semelhante de site").
  const needsPixel = kind === 'site' || (kind === 'lookalike' && lookalikeSource === 'site');
  useEffect(() => {
    if (!open || !effectiveAccountId || !needsPixel || pixels !== null) return;
    metaCreationService
      .listPixels(effectiveAccountId)
      .then(setPixels)
      .catch(() => toast.error('Erro ao carregar pixels da conta'));
  }, [open, effectiveAccountId, needsPixel, pixels]);

  // Páginas: só interessam a engajamento/Instagram (e ao "semelhante" dessas
  // fontes). A lista vem da própria conta de anúncio — o usuário não precisa
  // ter a BM selecionada na UI.
  const needsPages =
    kind === 'engagement' ||
    kind === 'instagram' ||
    (kind === 'lookalike' && (lookalikeSource === 'engagement' || lookalikeSource === 'instagram'));
  useEffect(() => {
    if (!open || !effectiveAccountId || !needsPages || pages !== null) return;
    metaCreationService
      .listPagesForAdAccount(effectiveAccountId)
      .then(setPages)
      .catch(() => toast.error('Erro ao carregar as páginas da conta'));
  }, [open, effectiveAccountId, needsPages, pages]);

  // Ao escolher a Página no tipo Instagram, tenta descobrir sozinho o
  // ig_user_id do perfil profissional ligado nela.
  const handlePageChange = (value: string) => {
    setPageId(value);
    if (kind !== 'instagram') return;
    setIgUserId('');
    setIgName('');
    metaCreationService
      .getInstagramAccountForPage(value)
      .then((ig) => {
        setIgUserId(ig.id);
        setIgName(ig.name);
      })
      .catch(() =>
        toast.info('Não consegui ler o Instagram dessa página — informe o ID do perfil abaixo.'),
      );
  };

  const finish = () => {
    reset();
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Informe o nome do público');
      return;
    }
    if (!effectiveAccountId) {
      toast.error('Selecione a conta de destino');
      return;
    }
    const common = {
      adAccountId: effectiveAccountId,
      name: name.trim(),
      description: description.trim() || undefined,
    };

    setSaving(true);
    try {
      if (kind === 'site') {
        if (!pixelId) {
          toast.error('Selecione o pixel');
          return;
        }
        await metaCreationService.createWebsiteAudience({
          ...common,
          pixelId,
          retentionDays: clampRetention(retentionDays, retentionMax),
          urlContains: urlContains.trim() || undefined,
        });
        toast.success('Público de site criado na Meta!');
        finish();
        onCreated();
      } else if (kind === 'engagement') {
        if (!pageId) {
          toast.error('Selecione a página');
          return;
        }
        await metaCreationService.createEngagementAudience({
          ...common,
          pageId,
          retentionDays: clampRetention(retentionDays, retentionMax),
          eventValue: engagementEvent,
        });
        toast.success('Público de engajamento criado na Meta!');
        finish();
        onCreated();
      } else if (kind === 'instagram') {
        if (!igUserId) {
          toast.error('Informe o ID do perfil do Instagram (ig_user_id)');
          return;
        }
        await metaCreationService.createInstagramAudience({
          ...common,
          igUserId,
          retentionDays: clampRetention(retentionDays, retentionMax),
          eventValue: engagementEvent,
        });
        toast.success('Público do Instagram criado na Meta!');
        finish();
        onCreated();
      } else if (kind === 'video') {
        const resolvedVideoId = videoId || extractVideoId(videoInput);
        if (!resolvedVideoId) {
          toast.error('Informe o ID ou o link do vídeo');
          return;
        }
        await metaCreationService.createVideoAudience({
          ...common,
          videoId: resolvedVideoId,
          retentionDays: clampRetention(retentionDays, retentionMax),
        });
        toast.success('Público de vídeo criado na Meta!');
        finish();
        onCreated();
      } else if (kind === 'app') {
        if (!appId) {
          toast.error('Informe o ID do app');
          return;
        }
        await metaCreationService.createAppAudience({
          ...common,
          appId,
          retentionDays: clampRetention(retentionDays, retentionMax),
          eventName: appEvent,
        });
        toast.success('Público de app criado na Meta!');
        finish();
        onCreated();
      } else if (kind === 'lookalike') {
        const sourceSpec = buildLookalikeSourceSpec();
        if (lookalikeSource === 'audience' && !originAudienceId) {
          toast.error('Selecione o público de origem');
          return;
        }
        if (lookalikeSource !== 'audience' && !sourceSpec) {
          toast.error('Preencha os dados da fonte do público semelhante');
          return;
        }
        await metaCreationService.createLookalikeAudience({
          ...common,
          originAudienceId: lookalikeSource === 'audience' ? originAudienceId : undefined,
          sourceSpec,
          lookalikeType,
          country,
          ratio: ratio / 100,
        });
        toast.success('Público semelhante criado na Meta!');
        finish();
        onCreated();
      } else {
        const audience = await metaCreationService.createCustomerListAudience(common);
        finish();
        onCustomerListCreated(audience);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar o público na Meta');
    } finally {
      setSaving(false);
    }
  };

  const renderSourceFields = (source: LookalikeSource) => {
    if (source === 'site') {
      return (
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
            <RetentionField value={retentionDays} onChange={setRetentionDays} maxDays={180} />
            <div className="space-y-1.5">
              <Label>URL contém (opcional)</Label>
              <Input value={urlContains} onChange={(e) => setUrlContains(e.target.value)} placeholder="/imoveis" />
            </div>
          </div>
        </>
      );
    }
    if (source === 'engagement') {
      return (
        <>
          <div className="space-y-1.5">
            <Label>Página do Facebook</Label>
            <Select value={pageId} onValueChange={handlePageChange}>
              <SelectTrigger>
                <SelectValue placeholder={pages === null ? 'Carregando...' : 'Selecione a página'} />
              </SelectTrigger>
              <SelectContent>
                {(pages || []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {pages?.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma página nesta conta.</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Interação</Label>
            <Select value={engagementEvent} onValueChange={setEngagementEvent}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {META_ENGAGEMENT_EVENTS.map((e) => (
                  <SelectItem key={e.value} value={e.value}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <RetentionField value={retentionDays} onChange={setRetentionDays} />
        </>
      );
    }
    if (source === 'instagram') {
      return (
        <>
          <div className="space-y-1.5">
            <Label>Página (pra achar o perfil)</Label>
            <Select value={pageId} onValueChange={handlePageChange}>
              <SelectTrigger>
                <SelectValue placeholder={pages === null ? 'Carregando...' : 'Selecione a página'} />
              </SelectTrigger>
              <SelectContent>
                {(pages || []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>ID do perfil do Instagram (ig_user_id)</Label>
            <Input
              value={igUserId}
              onChange={(e) => setIgUserId(e.target.value)}
              placeholder={igName ? `${igName} (${igUserId})` : 'automático ao escolher a página'}
            />
            {igName && <p className="text-xs text-muted-foreground">Perfil encontrado: {igName}</p>}
          </div>
          <EventSelect
            value={engagementEvent}
            onChange={setEngagementEvent}
            options={META_INSTAGRAM_EVENTS}
            defaultValue="ig_business_profile_engaged"
          />
          <RetentionField value={retentionDays} onChange={setRetentionDays} />
        </>
      );
    }
    if (source === 'app') {
      return (
        <>
          <AppIdField value={appId} onChange={setAppId} />
          <EventSelect value={appEvent} onChange={setAppEvent} options={META_APP_EVENTS} defaultValue="any" />
          <RetentionField value={retentionDays} onChange={setRetentionDays} />
        </>
      );
    }
    return (
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
        {originAudienceOptions.length === 0 && (
          <p className="text-xs text-muted-foreground">
            {isDuplicate
              ? 'A conta de destino ainda não tem nenhum público pra usar como origem — crie um lá primeiro.'
              : 'Esta conta ainda não tem nenhum público pra usar como origem.'}
          </p>
        )}
      </div>
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      {/* max-h + overflow: a grade de BM/conta dentro do modal estourava a
          tela sem rolagem (a barra de pesquisa de BM ficava "fora" do
          alcance visual). */}
      <DialogContent className={`${isDuplicate ? 'sm:max-w-2xl' : 'sm:max-w-lg'} max-h-[90vh] overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle>{isDuplicate ? 'Duplicar público' : 'Novo público'}</DialogTitle>
          <DialogDescription>
            {isDuplicate
              ? 'Escolha se a cópia vai para a mesma conta ou para outra conta de anúncio.'
              : 'Cria um público personalizado ou semelhante na conta de anúncio selecionada.'}
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
                    setTargetAudiences([]);
                    setPixels(null);
                    setPages(null);
                  }}
                >
                  Trocar
                </Button>
              </div>
            )}

            {note && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                <p>{note}</p>
                {kind === 'salvo' && onGoToSavedAudience && (
                  <Button variant="link" size="sm" className="h-auto p-0" onClick={onGoToSavedAudience}>
                    Abrir a aba Direcionamento <ExternalLink className="w-3.5 h-3.5 ml-1" />
                  </Button>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Tipo de público</Label>
              <Select
                value={kind}
                onValueChange={(v) => setKind(v as AudienceKind)}
                disabled={isDuplicate}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="site">Site (Pixel)</SelectItem>
                  <SelectItem value="engagement">Facebook Page (engajamento)</SelectItem>
                  <SelectItem value="instagram">Instagram (perfil profissional)</SelectItem>
                  <SelectItem value="video">Vídeo</SelectItem>
                  <SelectItem value="app">Atividade no app</SelectItem>
                  <SelectItem value="clientes">Lista de clientes</SelectItem>
                  <SelectItem value="lookalike">Semelhante (Lookalike)</SelectItem>
                </SelectContent>
              </Select>
              {isDuplicate && (
                <p className="text-xs text-muted-foreground">
                  O tipo vem do público de origem ({KIND_LABEL[kind]}) — não dá pra trocar na cópia.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameTouched(true);
                }}
                placeholder="Nome do público"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Descrição (opcional)</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            {kind === 'site' && renderSourceFields('site')}

            {kind === 'engagement' && renderSourceFields('engagement')}

            {kind === 'instagram' && renderSourceFields('instagram')}

            {kind === 'video' && (
              <>
                <div className="space-y-1.5">
                  <Label>ID ou link do vídeo</Label>
                  <Input
                    value={videoInput}
                    onChange={(e) => {
                      setVideoInput(e.target.value);
                      const extracted = extractVideoId(e.target.value);
                      if (extracted) setVideoId(extracted);
                    }}
                    placeholder="https://www.facebook.com/reel/1234567890 ou 1234567890"
                  />
                  <p className="text-xs text-muted-foreground">
                    O vídeo precisa pertencer à conta (ou a uma Página da conta).
                  </p>
                </div>
                <RetentionField value={retentionDays} onChange={setRetentionDays} />
              </>
            )}

            {kind === 'app' && renderSourceFields('app')}

            {kind === 'lookalike' && (
              <>
                <div className="space-y-1.5">
                  <Label>Origem do semelhante</Label>
                  <Select value={lookalikeSource} onValueChange={(v) => setLookalikeSource(v as LookalikeSource)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="audience">Um público que já existe nesta conta</SelectItem>
                      <SelectItem value="site">Site (pixel)</SelectItem>
                      <SelectItem value="engagement">Facebook Page</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="app">App</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {renderSourceFields(lookalikeSource)}
                <div className="grid grid-cols-3 gap-3">
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
                  <div className="space-y-1.5">
                    <Label>Tipo</Label>
                    <Select value={lookalikeType} onValueChange={(v) => setLookalikeType(v as 'similarity' | 'reach')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="similarity">Semelhança</SelectItem>
                        <SelectItem value="reach">Alcance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Semelhante de vídeo: escolha o público de vídeo da conta como origem.
                </p>
              </>
            )}

            {kind === 'clientes' && (
              <p className="text-xs text-muted-foreground">
                Depois de criar, você escolhe quais contatos do CRM entram nesse público
                {isDuplicate && ' — os contatos do público de origem não são copiados automaticamente'}.
              </p>
            )}

            {kind === 'salvo' && (
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <p>
                  Este público é um público salvo (direcionamento com localização, idade, gênero e
                  detalhamentos). Pra criar ou copiar esse tipo, use a aba Direcionamento.
                </p>
                {onGoToSavedAudience && (
                  <Button variant="link" size="sm" className="h-auto p-0 mt-1" onClick={onGoToSavedAudience}>
                    Abrir a aba Direcionamento <ExternalLink className="w-3.5 h-3.5 ml-1" />
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          {(!isDuplicate || targetAccount) && kind !== 'salvo' && (
            <Button onClick={handleSubmit} disabled={saving || loadingDetail}>
              {saving ? 'Criando...' : isDuplicate ? 'Criar cópia' : 'Criar público'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const RetentionField = ({
  value,
  onChange,
  maxDays = 365,
}: {
  value: number;
  onChange: (v: number) => void;
  maxDays?: number;
}) => (
  <div className="space-y-1.5">
    <Label>Retenção (dias)</Label>
    <Input
      type="number"
      min={1}
      max={maxDays}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
    <p className="text-xs text-muted-foreground">A Meta aceita de 1 a {maxDays} dias pra este tipo.</p>
  </div>
);

const EventSelect = ({
  value,
  onChange,
  options,
  defaultValue,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  defaultValue: string;
}) => (
  <div className="space-y-1.5">
    <Label>Evento</Label>
    <Select value={value || defaultValue} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    <p className="text-xs text-muted-foreground">Qualquer outro nome de evento da Meta também funciona.</p>
  </div>
);

const AppIdField = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <div className="space-y-1.5">
    <Label>ID do app</Label>
    <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="123456789012345" />
    <p className="text-xs text-muted-foreground">App precisa ter o App Events/SDK da Meta instalado.</p>
  </div>
);
