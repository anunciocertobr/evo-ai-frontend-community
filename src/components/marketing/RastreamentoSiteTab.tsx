import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Search, X } from 'lucide-react';
import { Card, CardContent, Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@evoapi/design-system';
import { sitesService, type Site, type SiteLeadSubmission } from '@/services/sites/sitesService';

const ALL = '__all__';
const TOTAL_COLUMNS = 13;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

interface Row extends SiteLeadSubmission {
  site_name: string;
}

// Leads de formulário/e-commerce vindos do webhook de tag do Google Tag
// Manager (ver Dashboards > Sites) — uma das 3 abas do Rastreamentos. Só
// alguns sites cadastrados (não milhares de IDs como na aba WhatsApp), por
// isso busca os leads de todos em paralelo sem precisar de lote/limite.
export function RastreamentoSiteTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [siteFilter, setSiteFilter] = useState(ALL);
  const [sites, setSites] = useState<Site[]>([]);

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
        const siteList = await sitesService.list();
        setSites(siteList);
        const leadsBySite = await Promise.all(siteList.map((site) => sitesService.getLeads(site.id)));
        const merged: Row[] = leadsBySite.flatMap((leads, i) => leads.map((lead) => ({ ...lead, site_name: siteList[i].name || siteList[i].hostname || siteList[i].url })));
        merged.sort((a, b) => (b.created_at > a.created_at ? 1 : -1));
        setRows(merged);
      } catch {
        toast.error('Erro ao carregar os leads dos sites.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const hasActiveFilters = dateFrom || dateTo || siteFilter !== ALL || search;
  const clearFilters = () => {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setSiteFilter(ALL);
  };

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59`) : null;

    return rows.filter((r) => {
      if (siteFilter !== ALL && r.site_name !== siteFilter) return false;
      const createdAt = new Date(r.created_at);
      if (from && createdAt < from) return false;
      if (to && createdAt > to) return false;
      if (!term) return true;
      const campos = [r.name, r.first_name, r.last_name, r.phone, r.email, r.utm_campaign, r.utm_source];
      return campos.some((v) => v?.toLowerCase().includes(term));
    });
  }, [rows, search, dateFrom, dateTo, siteFilter]);

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    setScrollWidth(el.scrollWidth);
  }, [loading, filteredRows]);

  return (
    <div className="flex flex-col h-full space-y-4">
      {!loading && rows.length > 0 && (
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
              <Label className="text-xs">Site</Label>
              <Select value={siteFilter} onValueChange={setSiteFilter}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos os sites</SelectItem>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={s.name || s.hostname || s.url}>
                      {s.name || s.hostname || s.url}
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
              {filteredRows.length === rows.length ? `${rows.length} lead(s)` : `${filteredRows.length} de ${rows.length} lead(s)`}
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
                  <th className="text-left p-3 font-medium whitespace-nowrap">Site</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">Nome</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">Telefone</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">E-mail</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">Evento</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">UTM Source</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">UTM Medium</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">UTM Campaign</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">UTM Content</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">UTM Term</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">Clid (gclid/fbclid)</th>
                  <th className="text-left p-3 font-medium whitespace-nowrap">Página de origem</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={TOTAL_COLUMNS} className="p-6 text-center text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Carregando...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={TOTAL_COLUMNS} className="p-6 text-center text-muted-foreground">Nenhum lead de site encontrado</td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={TOTAL_COLUMNS} className="p-6 text-center text-muted-foreground">Nenhum lead encontrado pra essa busca/filtro.</td>
                  </tr>
                ) : (
                  filteredRows.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-muted/50">
                      <td className="p-3 whitespace-nowrap text-muted-foreground">{formatDate(r.created_at)}</td>
                      <td className="p-3 whitespace-nowrap">{r.site_name}</td>
                      <td className="p-3 whitespace-nowrap">{r.name || [r.first_name, r.last_name].filter(Boolean).join(' ') || '-'}</td>
                      <td className="p-3 whitespace-nowrap">{r.phone || '-'}</td>
                      <td className="p-3 whitespace-nowrap">{r.email || '-'}</td>
                      <td className="p-3 whitespace-nowrap">{r.event_name || '-'}</td>
                      <td className="p-3 whitespace-nowrap">{r.utm_source || '-'}</td>
                      <td className="p-3 whitespace-nowrap">{r.utm_medium || '-'}</td>
                      <td className="p-3 whitespace-nowrap">{r.utm_campaign || '-'}</td>
                      <td className="p-3 whitespace-nowrap">{r.utm_content || '-'}</td>
                      <td className="p-3 whitespace-nowrap">{r.utm_term || '-'}</td>
                      <td className="p-3 max-w-[200px] truncate" title={r.gclid || r.fbclid || ''}>{r.gclid || r.fbclid || '-'}</td>
                      <td className="p-3 max-w-[260px] truncate" title={r.page_url || ''}>{r.page_url || '-'}</td>
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
