import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Film, ExternalLink, Search, X } from 'lucide-react';
import {
  Card,
  CardContent,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@evoapi/design-system';
import { BaseHeader } from '@/components/base';
import { RastreamentoConversionButton } from '@/components/marketing/RastreamentoConversionButton';
import { rastreamentosService, type HelenaAdContext } from '@/services/marketing/rastreamentosService';

const ALL = '__all__';

interface HelenaUtm {
  source?: string;
  sourceId?: string;
  campaign?: string;
  clid?: string;
  medium?: string;
  content?: string;
  headline?: string;
  referralUrl?: string;
}

interface HelenaContact {
  id: string;
  name?: string;
  nameWhatsapp?: string;
  phoneNumber?: string;
  phoneNumberFormatted?: string;
  email?: string;
  origin?: string;
  utm?: HelenaUtm;
  createdAt?: string;
}

function uniqueOptions(values: Array<{ id?: string | null; name?: string | null }>) {
  const seen = new Map<string, string>();
  values.forEach((v) => {
    if (!v.id || seen.has(v.id)) return;
    seen.set(v.id, v.name || v.id);
  });
  return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// Contatos importados da API WTS/Helena com dados de origem (Meta/Instagram)
// — página própria em Marketing (logo abaixo de "Relatórios" no menu),
// porque é rastreamento de origem de lead de campanha, não métrica de
// atendimento do CRM. utm.sourceId é o AD_ID de verdade (confirmado contra
// a Graph API: só anúncio tem adset_id/campaign_id/creative) — usado pra
// enriquecer com nome de campanha/conjunto/anúncio e criativo, igual a
// tela "Ver Leads" (LeadFormLeadsDialog) já faz pros leads de formulário.
export default function RastreamentosPage() {
  const [contacts, setContacts] = useState<HelenaContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [adContextByAdId, setAdContextByAdId] = useState<Record<string, HelenaAdContext>>({});
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [campaignFilter, setCampaignFilter] = useState(ALL);
  const [adsetFilter, setAdsetFilter] = useState(ALL);
  const [adFilter, setAdFilter] = useState(ALL);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const items = await rastreamentosService.allContacts(100);
        setContacts(items);

        const uniqueAdIds = Array.from(new Set(items.map((c: HelenaContact) => c.utm?.sourceId).filter(Boolean))) as string[];
        const results = await Promise.all(uniqueAdIds.map((adId) => rastreamentosService.adContext(adId)));
        const byId: Record<string, HelenaAdContext> = {};
        results.forEach((ctx) => {
          if (ctx) byId[ctx.ad_id] = ctx;
        });
        setAdContextByAdId(byId);
      } catch {
        toast.error('Erro ao carregar os contatos da Helena/WTS.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const contextFor = useCallback(
    (contact: HelenaContact) => {
      const adId = contact.utm?.sourceId;
      return adId ? adContextByAdId[adId] : undefined;
    },
    [adContextByAdId],
  );

  const campaignOptions = useMemo(
    () => uniqueOptions(Object.values(adContextByAdId).map((c) => ({ id: c.campaign_id, name: c.campaign_name }))),
    [adContextByAdId],
  );
  const adsetOptions = useMemo(
    () =>
      uniqueOptions(
        Object.values(adContextByAdId)
          .filter((c) => campaignFilter === ALL || c.campaign_id === campaignFilter)
          .map((c) => ({ id: c.adset_id, name: c.adset_name })),
      ),
    [adContextByAdId, campaignFilter],
  );
  const adOptions = useMemo(
    () =>
      uniqueOptions(
        Object.values(adContextByAdId)
          .filter((c) => (campaignFilter === ALL || c.campaign_id === campaignFilter) && (adsetFilter === ALL || c.adset_id === adsetFilter))
          .map((c) => ({ id: c.ad_id, name: c.ad_name })),
      ),
    [adContextByAdId, campaignFilter, adsetFilter],
  );

  useEffect(() => {
    if (adsetFilter !== ALL && !adsetOptions.some((o) => o.id === adsetFilter)) setAdsetFilter(ALL);
  }, [adsetOptions, adsetFilter]);
  useEffect(() => {
    if (adFilter !== ALL && !adOptions.some((o) => o.id === adFilter)) setAdFilter(ALL);
  }, [adOptions, adFilter]);

  const hasActiveFilters = dateFrom || dateTo || campaignFilter !== ALL || adsetFilter !== ALL || adFilter !== ALL || search;
  const clearFilters = () => {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setCampaignFilter(ALL);
    setAdsetFilter(ALL);
    setAdFilter(ALL);
  };

  const filteredContacts = useMemo(() => {
    const term = search.trim().toLowerCase();
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59`) : null;

    return contacts.filter((c) => {
      const ctx = contextFor(c);
      if (campaignFilter !== ALL && ctx?.campaign_id !== campaignFilter) return false;
      if (adsetFilter !== ALL && ctx?.adset_id !== adsetFilter) return false;
      if (adFilter !== ALL && c.utm?.sourceId !== adFilter) return false;

      if (c.createdAt) {
        const createdAt = new Date(c.createdAt);
        if (from && createdAt < from) return false;
        if (to && createdAt > to) return false;
      }

      if (!term) return true;
      const campos = [c.name, c.nameWhatsapp, c.phoneNumber, c.email, ctx?.campaign_name, ctx?.adset_name, ctx?.ad_name];
      return campos.some((v) => v?.toLowerCase().includes(term));
    });
  }, [contacts, search, dateFrom, dateTo, campaignFilter, adsetFilter, adFilter, contextFor]);

  const openCreative = (ctx?: HelenaAdContext) => {
    if (ctx?.criativo?.video) window.open(ctx.criativo.video, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-col min-h-full bg-background p-6 space-y-4">
      <BaseHeader
        title="Rastreamentos"
        subtitle="Contatos importados da API WTS/Helena com dados de origem (Meta/Instagram)"
      />

      {!loading && contacts.length > 0 && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs">De</Label>
              <Input type="date" value={dateFrom} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateFrom(e.target.value)} className="w-[150px]" />
            </div>
            <div>
              <Label className="text-xs">Até</Label>
              <Input type="date" value={dateTo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDateTo(e.target.value)} className="w-[150px]" />
            </div>
            <div>
              <Label className="text-xs">Campanha</Label>
              <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas as campanhas</SelectItem>
                  {campaignOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Conjunto</Label>
              <Select value={adsetFilter} onValueChange={setAdsetFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos os conjuntos</SelectItem>
                  {adsetOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Anúncio</Label>
              <Select value={adFilter} onValueChange={setAdFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos os anúncios</SelectItem>
                  {adOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-3.5 h-3.5 mr-1" /> Limpar filtros
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                placeholder="Buscar nome, telefone, e-mail..."
                className="pl-8"
              />
            </div>
            <p className="text-sm text-muted-foreground whitespace-nowrap">
              {filteredContacts.length === contacts.length ? `${contacts.length} contato(s)` : `${filteredContacts.length} de ${contacts.length} contato(s)`}
            </p>
          </div>
        </>
      )}

      <Card className="flex-1 overflow-hidden">
        <CardContent className="p-0 h-full">
          <div className="overflow-auto h-full max-h-[70vh]">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0 z-10">
                <tr className="border-b">
                  <th className="text-left p-3 font-medium whitespace-nowrap">Data</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">Nome</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">Telefone</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">E-mail</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">Campanha</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">Conjunto</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">Anúncio</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">Criativo</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">Clid</th>
                  <th className="p-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="p-6 text-center text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Carregando...
                    </td>
                  </tr>
                ) : contacts.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-6 text-center text-muted-foreground">Nenhum contato encontrado</td>
                  </tr>
                ) : filteredContacts.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-6 text-center text-muted-foreground">Nenhum contato encontrado pra essa busca/filtro.</td>
                  </tr>
                ) : (
                  filteredContacts.map((c) => {
                    const ctx = contextFor(c);
                    const criativo = ctx?.criativo;
                    return (
                      <tr key={c.id} className="border-b hover:bg-muted/50">
                        <td className="p-3 whitespace-nowrap text-muted-foreground">{c.createdAt ? formatDate(c.createdAt) : '-'}</td>
                        <td className="p-3 whitespace-nowrap">{c.name || c.nameWhatsapp || '-'}</td>
                        <td className="p-3 whitespace-nowrap">{c.phoneNumberFormatted || c.phoneNumber || '-'}</td>
                        <td className="p-3 whitespace-nowrap">{c.email || '-'}</td>
                        <td className="p-3 whitespace-nowrap">
                          <span>{ctx?.campaign_name || '-'}</span>
                          {ctx?.campaign_id && <span className="block text-[10px] font-mono text-muted-foreground">{ctx.campaign_id}</span>}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span>{ctx?.adset_name || '-'}</span>
                          {ctx?.adset_id && <span className="block text-[10px] font-mono text-muted-foreground">{ctx.adset_id}</span>}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span>{ctx?.ad_name || '-'}</span>
                          {c.utm?.sourceId && <span className="block text-[10px] font-mono text-muted-foreground">{c.utm.sourceId}</span>}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {criativo?.thumbnail_url || criativo?.imagem ? (
                            <HoverCard openDelay={150} closeDelay={0}>
                              <HoverCardTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => openCreative(ctx)}
                                  disabled={!criativo?.video}
                                  className="relative inline-block w-10 h-10 rounded overflow-hidden border border-border group disabled:cursor-default"
                                  title={criativo?.video ? 'Ver o post na Meta' : criativo?.criativo_nome || 'Criativo'}
                                >
                                  <img src={criativo.imagem || criativo.thumbnail_url || ''} alt={criativo?.criativo_nome || ''} className="w-full h-full object-cover" />
                                  {criativo?.video && (
                                    <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
                                      <ExternalLink className="w-4 h-4 text-white opacity-0 group-hover:opacity-100" />
                                    </span>
                                  )}
                                </button>
                              </HoverCardTrigger>
                              <HoverCardContent className="w-auto p-2" side="right">
                                <div className="relative">
                                  <img
                                    src={criativo.imagem || criativo.thumbnail_url || ''}
                                    alt={criativo?.criativo_nome || ''}
                                    className="max-w-[320px] max-h-[320px] rounded object-contain"
                                  />
                                  {criativo?.video && (
                                    <span className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                                      <Film className="w-3 h-3" /> Vídeo
                                    </span>
                                  )}
                                </div>
                                {(criativo?.titulo || criativo?.texto_principal) && (
                                  <p className="text-xs mt-1.5 max-w-[320px] line-clamp-3 text-muted-foreground">
                                    {criativo?.titulo || criativo?.texto_principal}
                                  </p>
                                )}
                              </HoverCardContent>
                            </HoverCard>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-3 max-w-[200px] truncate" title={c.utm?.clid || ''}>
                          {c.utm?.clid || '-'}
                        </td>
                        <td className="p-3">
                          <RastreamentoConversionButton adId={c.utm?.sourceId} ctwaClid={c.utm?.clid} phone={c.phoneNumber} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
