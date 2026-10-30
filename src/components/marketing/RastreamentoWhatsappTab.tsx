import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Search, X } from 'lucide-react';
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
import { adLeadsService, type AdLead } from '@/services/marketing/adLeadsService';

const ALL = '__all__';
const TOTAL_COLUMNS = 13;

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

// Leads de WhatsApp capturados pela NOSSA PRÓPRIA base de atribuição
// (AdLead, ver Whatsapp::AdReferralCapture / IncomingMessageBaseService —
// webhook oficial da Meta, sem depender de nenhum sistema externo) — aba
// "WhatsApp" do Rastreamentos. Diferente da aba "Externo" (Helena/WTS, ver
// RastreamentoExternoTab.tsx): aqui campanha/conjunto/anúncio/criativo já
// vêm prontos em cada registro, sem precisar enriquecer um a um.
export function RastreamentoWhatsappTab() {
  const [leads, setLeads] = useState<AdLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [campaignFilter, setCampaignFilter] = useState(ALL);
  const [adsetFilter, setAdsetFilter] = useState(ALL);
  const [adFilter, setAdFilter] = useState(ALL);

  const tableScrollRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const syncingRef = useRef<'top' | 'table' | null>(null);

  const handleTopScroll = () => {
    if (syncingRef.current === 'table') { syncingRef.current = null; return; }
    if (!topScrollRef.current || !tableScrollRef.current) return;
    syncingRef.current = 'top';
    tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
  };
  const handleTableScroll = () => {
    if (syncingRef.current === 'top') { syncingRef.current = null; return; }
    if (!topScrollRef.current || !tableScrollRef.current) return;
    syncingRef.current = 'table';
    topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const items = await adLeadsService.list();
        setLeads(items);
      } catch {
        toast.error('Erro ao carregar os leads de WhatsApp.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const campaignOptions = useMemo(() => uniqueOptions(leads.map((l) => ({ id: l.campaign_id, name: l.campaign_name }))), [leads]);
  const adsetOptions = useMemo(
    () => uniqueOptions(leads.filter((l) => campaignFilter === ALL || l.campaign_id === campaignFilter).map((l) => ({ id: l.adset_id, name: l.adset_name }))),
    [leads, campaignFilter],
  );
  const adOptions = useMemo(
    () =>
      uniqueOptions(
        leads
          .filter((l) => (campaignFilter === ALL || l.campaign_id === campaignFilter) && (adsetFilter === ALL || l.adset_id === adsetFilter))
          .map((l) => ({ id: l.ad_id, name: l.ad_name })),
      ),
    [leads, campaignFilter, adsetFilter],
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

  const filteredLeads = useMemo(() => {
    const term = search.trim().toLowerCase();
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59`) : null;

    return leads.filter((l) => {
      if (campaignFilter !== ALL && l.campaign_id !== campaignFilter) return false;
      if (adsetFilter !== ALL && l.adset_id !== adsetFilter) return false;
      if (adFilter !== ALL && l.ad_id !== adFilter) return false;

      const createdAt = new Date(l.data_criacao);
      if (from && createdAt < from) return false;
      if (to && createdAt > to) return false;

      if (!term) return true;
      const campos = [l.nome, l.telefone, l.email, l.campaign_name, l.adset_name, l.ad_name];
      return campos.some((v) => v?.toLowerCase().includes(term));
    });
  }, [leads, search, dateFrom, dateTo, campaignFilter, adsetFilter, adFilter]);

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    setScrollWidth(el.scrollWidth);
  }, [loading, filteredLeads]);

  return (
    <div className="flex flex-col h-full space-y-4">
      {!loading && leads.length > 0 && (
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
              {filteredLeads.length === leads.length ? `${leads.length} lead(s)` : `${filteredLeads.length} de ${leads.length} lead(s)`}
            </p>
          </div>
        </>
      )}

      <Card className="flex-1 overflow-hidden">
        <CardContent className="p-0 h-full flex flex-col">
          <div ref={topScrollRef} onScroll={handleTopScroll} className="overflow-x-auto overflow-y-hidden shrink-0" style={{ height: 14 }}>
            <div style={{ width: scrollWidth, height: 1 }} />
          </div>
          <div ref={tableScrollRef} onScroll={handleTableScroll} className="overflow-auto h-full max-h-[65vh]">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0 z-10">
                <tr className="border-b">
                  <th className="text-left p-3 font-medium whitespace-nowrap">Data</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">Nome</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">Telefone</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">E-mail</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">Status</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">Campanha</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">Conjunto</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">Anúncio</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">Criativo</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">Clid</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">UTM Source</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">UTM Campaign</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">Valor venda</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={TOTAL_COLUMNS} className="p-6 text-center text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Carregando...
                    </td>
                  </tr>
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={TOTAL_COLUMNS} className="p-6 text-center text-muted-foreground">Nenhum lead de WhatsApp encontrado</td>
                  </tr>
                ) : filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={TOTAL_COLUMNS} className="p-6 text-center text-muted-foreground">Nenhum lead encontrado pra essa busca/filtro.</td>
                  </tr>
                ) : (
                  filteredLeads.map((l) => (
                    <tr key={l.id} className="border-b hover:bg-muted/50">
                      <td className="p-3 whitespace-nowrap text-muted-foreground">{formatDate(l.data_criacao)}</td>
                      <td className="p-3 whitespace-nowrap">{l.nome || '-'}</td>
                      <td className="p-3 whitespace-nowrap">{l.telefone || '-'}</td>
                      <td className="p-3 whitespace-nowrap">{l.email || '-'}</td>
                      <td className="p-3 whitespace-nowrap">{l.status || '-'}</td>
                      <td className="p-3 whitespace-nowrap">
                        <span>{l.campaign_name || '-'}</span>
                        {l.campaign_id && <span className="block text-[10px] font-mono text-muted-foreground">{l.campaign_id}</span>}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span>{l.adset_name || '-'}</span>
                        {l.adset_id && <span className="block text-[10px] font-mono text-muted-foreground">{l.adset_id}</span>}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span>{l.ad_name || '-'}</span>
                        {l.ad_id && <span className="block text-[10px] font-mono text-muted-foreground">{l.ad_id}</span>}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {l.Anuncio_thumbnail_url ? (
                          <HoverCard openDelay={150} closeDelay={0}>
                            <HoverCardTrigger asChild>
                              <button
                                type="button"
                                className="relative inline-block w-10 h-10 rounded overflow-hidden border border-border"
                                title={l.Anuncio_title || 'Criativo'}
                              >
                                <img src={l.Anuncio_thumbnail_url} alt={l.Anuncio_title || ''} className="w-full h-full object-cover" />
                              </button>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-auto p-2" side="right">
                              <img src={l.Anuncio_thumbnail_url} alt={l.Anuncio_title || ''} className="max-w-[320px] max-h-[320px] rounded object-contain" />
                              {(l.Anuncio_title || l.Anuncio_body) && (
                                <p className="text-xs mt-1.5 max-w-[320px] line-clamp-3 text-muted-foreground">{l.Anuncio_title || l.Anuncio_body}</p>
                              )}
                            </HoverCardContent>
                          </HoverCard>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-3 max-w-[200px] truncate" title={l.ctwaclid || ''}>{l.ctwaclid || '-'}</td>
                      <td className="p-3 whitespace-nowrap">{l.utm_source || '-'}</td>
                      <td className="p-3 whitespace-nowrap">{l.utm_campaign || '-'}</td>
                      <td className="p-3 whitespace-nowrap">{l.valor_venda ? `R$ ${l.valor_venda}` : '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
