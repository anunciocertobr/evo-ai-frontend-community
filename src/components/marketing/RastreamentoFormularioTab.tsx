import { useEffect, useMemo, useRef, useState } from 'react';
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
import { metaLeadFormsService } from '@/services/admin/metaLeadFormsService';
import type { LeadSearchResult } from '@/services/marketing/metaCreationService';

const ALL = '__all__';
const TOTAL_COLUMNS = 9;

// Pergunta do formulário pode se chamar "full_name", "nome_completo",
// "qual_seu_nome" etc. — cada formulário define as próprias perguntas, não
// tem campo fixo. Heurística por substring pra achar nome/telefone/e-mail
// sem precisar de uma coluna por formulário (que não daria pra tabular
// quando a lista mistura leads de formulários diferentes).
function guessField(lead: LeadSearchResult, candidates: string[]): string {
  const field = lead.field_data?.find((f) => candidates.some((c) => f.name.toLowerCase().includes(c)));
  return field?.values?.[0] || '';
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

// Leads de formulário do Meta Lead Ads (Criação Meta > formulários
// mapeados) — uma das 3 abas do Rastreamentos. Agrega vários formulários
// de uma vez (GET all_leads, cacheado/limitado no backend — ver
// comentário em Api::V1::Admin::MetaLeadFormsController#all_leads), ao
// contrário de "Ver Leads" que sempre olha um formulário só.
export function RastreamentoFormularioTab() {
  const [leads, setLeads] = useState<LeadSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [formFilter, setFormFilter] = useState(ALL);
  const [campaignFilter, setCampaignFilter] = useState(ALL);

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
        const items = await metaLeadFormsService.allLeads();
        setLeads(items);
      } catch {
        toast.error('Erro ao carregar os leads de formulário.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const formOptions = useMemo(() => uniqueOptions(leads.map((l) => ({ id: l.form_id, name: l.form_name }))), [leads]);
  const campaignOptions = useMemo(() => uniqueOptions(leads.map((l) => ({ id: l.campaign_id, name: l.campaign_name }))), [leads]);

  const hasActiveFilters = dateFrom || dateTo || formFilter !== ALL || campaignFilter !== ALL || search;
  const clearFilters = () => {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setFormFilter(ALL);
    setCampaignFilter(ALL);
  };

  const filteredLeads = useMemo(() => {
    const term = search.trim().toLowerCase();
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59`) : null;

    return leads.filter((lead) => {
      if (formFilter !== ALL && lead.form_id !== formFilter) return false;
      if (campaignFilter !== ALL && lead.campaign_id !== campaignFilter) return false;

      const createdAt = new Date(lead.created_time);
      if (from && createdAt < from) return false;
      if (to && createdAt > to) return false;

      if (!term) return true;
      const campos = [
        ...(lead.field_data?.flatMap((f) => f.values) || []),
        lead.campaign_name,
        lead.adset_name,
        lead.ad_name,
        lead.form_name,
      ];
      return campos.some((v) => v?.toLowerCase().includes(term));
    });
  }, [leads, search, dateFrom, dateTo, formFilter, campaignFilter]);

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    setScrollWidth(el.scrollWidth);
  }, [loading, filteredLeads]);

  const openCreative = (lead: LeadSearchResult) => {
    if (lead.criativo_link) window.open(lead.criativo_link, '_blank', 'noopener,noreferrer');
  };

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
              <Label className="text-xs">Formulário</Label>
              <Select value={formFilter} onValueChange={setFormFilter}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos os formulários</SelectItem>
                  {formOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              {' · últimos formulários mapeados'}
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
                  <th className="text-left p-3 font-medium whitespace-nowrap">Formulário</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">Nome</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">Telefone</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">E-mail</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">Campanha</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">Conjunto</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">Anúncio</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">Criativo</th>
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
                    <td colSpan={TOTAL_COLUMNS} className="p-6 text-center text-muted-foreground">Nenhum lead de formulário encontrado</td>
                  </tr>
                ) : filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={TOTAL_COLUMNS} className="p-6 text-center text-muted-foreground">Nenhum lead encontrado pra essa busca/filtro.</td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => (
                    <tr key={lead.id} className="border-b hover:bg-muted/50">
                      <td className="p-3 whitespace-nowrap text-muted-foreground">{formatDate(lead.created_time)}</td>
                      <td className="p-3 whitespace-nowrap">{lead.form_name}</td>
                      <td className="p-3 whitespace-nowrap">{guessField(lead, ['full_name', 'nome', 'name']) || '-'}</td>
                      <td className="p-3 whitespace-nowrap">{guessField(lead, ['phone', 'telefone', 'celular']) || '-'}</td>
                      <td className="p-3 whitespace-nowrap">{guessField(lead, ['email', 'e-mail']) || '-'}</td>
                      <td className="p-3 whitespace-nowrap">
                        <span>{lead.campaign_name || '-'}</span>
                        {lead.campaign_id && <span className="block text-[10px] font-mono text-muted-foreground">{lead.campaign_id}</span>}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span>{lead.adset_name || '-'}</span>
                        {lead.adset_id && <span className="block text-[10px] font-mono text-muted-foreground">{lead.adset_id}</span>}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span>{lead.ad_name || '-'}</span>
                        {lead.ad_id && <span className="block text-[10px] font-mono text-muted-foreground">{lead.ad_id}</span>}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {lead.criativo_imagem ? (
                          <HoverCard openDelay={150} closeDelay={0}>
                            <HoverCardTrigger asChild>
                              <button
                                type="button"
                                onClick={() => openCreative(lead)}
                                disabled={!lead.criativo_video}
                                className="relative inline-block w-10 h-10 rounded overflow-hidden border border-border group disabled:cursor-default"
                                title={lead.criativo_video ? 'Ver o post na Meta' : lead.criativo_nome || 'Criativo'}
                              >
                                <img src={lead.criativo_imagem} alt={lead.criativo_nome || ''} className="w-full h-full object-cover" />
                                {lead.criativo_video && (
                                  <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
                                    <ExternalLink className="w-4 h-4 text-white opacity-0 group-hover:opacity-100" />
                                  </span>
                                )}
                              </button>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-auto p-2" side="right">
                              <div className="relative">
                                <img src={lead.criativo_imagem} alt={lead.criativo_nome || ''} className="max-w-[320px] max-h-[320px] rounded object-contain" />
                                {lead.criativo_video && (
                                  <span className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                                    <Film className="w-3 h-3" /> Vídeo
                                  </span>
                                )}
                              </div>
                              {(lead.criativo_titulo || lead.criativo_texto_principal) && (
                                <p className="text-xs mt-1.5 max-w-[320px] line-clamp-3 text-muted-foreground">
                                  {lead.criativo_titulo || lead.criativo_texto_principal}
                                </p>
                              )}
                            </HoverCardContent>
                          </HoverCard>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
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
