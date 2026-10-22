import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Download, Search, ChevronDown, ChevronRight, X } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@evoapi/design-system';
import { sitesService, type Site, type SiteLeadSubmission } from '@/services/sites/sitesService';

const ALL = '__all__';
const COLUMN_COUNT = 15;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  site: Site | null;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const csvEscape = (value: string) => `"${(value || '').replace(/"/g, '""')}"`;

// "Ver leads" de um Site — mesmo padrão visual/estrutural de
// LeadFormLeadsDialog.tsx (dialog full-screen, busca livre, filtro de
// data, exportar CSV com BOM, linha expansível), mas as colunas são FIXAS
// e conhecidas (o payload do GTM é JSON livre, não um array {name,values}
// fixo como no Meta) — a linha expansível mostra o raw_payload inteiro em
// JSON pra garantir que nenhum campo extra que o cliente mandar fique
// invisível. Colunas espelham os parâmetros que a tag "Planilha Google" já
// manda pra esse tipo de cliente (categoria/pagamento/utms/fbp/fbc/etc —
// ver Sites::WebhookPayloadParser).
export function SiteLeadsDialog({ open, onOpenChange, site }: Props) {
  const [leads, setLeads] = useState<SiteLeadSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [eventFilter, setEventFilter] = useState(ALL);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Barra de rolagem horizontal "fantasma" fixada no topo da tabela,
  // sincronizada com o scroll de verdade do container abaixo — sem isso,
  // com muitas colunas a barra nativa só fica visível depois de rolar a
  // tela toda pra baixo até o fim da tabela (achado pedindo pro usuário
  // testar ao vivo).
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const syncingRef = useRef<'top' | 'table' | null>(null);

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    setScrollWidth(el.scrollWidth);
    // As colunas são sempre as mesmas 13 fixas — a largura real só muda
    // quando os dados terminam de carregar (tabela passa a existir no DOM).
  }, [loading]);

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
    if (!open || !site) return;
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setEventFilter(ALL);
    setLoading(true);
    sitesService
      .getLeads(site.id)
      .then(setLeads)
      .catch(() => toast.error('Falha ao buscar os leads desse site.'))
      .finally(() => setLoading(false));
  }, [open, site]);

  const eventOptions = useMemo(() => {
    const seen = new Set<string>();
    leads.forEach((l) => l.event_name && seen.add(l.event_name));
    return Array.from(seen);
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const term = search.trim().toLowerCase();
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59`) : null;

    return leads.filter((lead) => {
      if (eventFilter !== ALL && lead.event_name !== eventFilter) return false;

      const createdAt = new Date(lead.created_at);
      if (from && createdAt < from) return false;
      if (to && createdAt > to) return false;

      if (!term) return true;
      const campos = [lead.name, lead.email, lead.phone, lead.utm_source, lead.utm_campaign, lead.page_url, lead.payment_method];
      return campos.some((valor) => valor?.toLowerCase().includes(term));
    });
  }, [leads, search, dateFrom, dateTo, eventFilter]);

  const hasActiveFilters = dateFrom || dateTo || eventFilter !== ALL;
  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setEventFilter(ALL);
  };

  const downloadCsv = () => {
    const header = [
      'Data', 'Evento', 'Nome', 'Primeiro Nome', 'Sobrenome', 'Email', 'Telefone', 'Valor', 'Moeda',
      'Qtd Itens', 'Produtos', 'IDs Produtos', 'Categorias', 'Tipo Conteúdo', 'Pagamento', 'Cupom',
      'Página de origem', 'UTM Source', 'UTM Campaign', 'Cidade', 'Estado', 'CEP', 'País', 'Gênero',
      'Data Nascimento', 'Qtd Compras Cliente', 'Valor Total Cliente', 'External ID',
    ];
    const rows = filteredLeads.map((lead) => [
      formatDate(lead.created_at),
      lead.event_name || '',
      lead.name || '',
      lead.first_name || '',
      lead.last_name || '',
      lead.email || '',
      lead.phone || '',
      lead.value || '',
      lead.currency || '',
      lead.num_items != null ? String(lead.num_items) : '',
      (lead.content_name || []).join('; '),
      (lead.product_ids || []).join('; '),
      (lead.content_category || []).join('; '),
      lead.content_type || '',
      lead.payment_method || '',
      lead.coupon || '',
      lead.page_url || '',
      lead.utm_source || '',
      lead.utm_campaign || '',
      lead.address_city || '',
      lead.address_state || '',
      lead.address_zip || '',
      lead.address_country || '',
      lead.gender || '',
      lead.birth_date || '',
      lead.customer_total_orders != null ? String(lead.customer_total_orders) : '',
      lead.customer_total_order_value || '',
      lead.external_id || '',
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([`${String.fromCharCode(0xfeff)}${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${(site?.name || site?.hostname || 'site').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-screen max-w-[100vw] sm:max-w-[100vw] h-screen max-h-[100vh] rounded-none flex flex-col">
        <DialogHeader>
          <DialogTitle>Leads — {site?.name || site?.url}</DialogTitle>
          <DialogDescription>Todos os eventos já recebidos pelo webhook deste site.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : leads.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">
            Nenhum evento recebido ainda — configure o webhook (botão "Configurar Webhook" no card) numa tag do GTM.
          </p>
        ) : (
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
                <Label className="text-xs">Evento</Label>
                <Select value={eventFilter} onValueChange={setEventFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todos os eventos</SelectItem>
                    {eventOptions.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
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
                  placeholder="Buscar lead..."
                  className="pl-8"
                />
              </div>
              <p className="text-sm text-muted-foreground whitespace-nowrap">
                {filteredLeads.length === leads.length ? `${leads.length} lead(s)` : `${filteredLeads.length} de ${leads.length} lead(s)`}
              </p>
              <Button size="sm" onClick={downloadCsv}>
                <Download className="w-3.5 h-3.5 mr-1.5" /> Baixar CSV
              </Button>
            </div>
            <div ref={topScrollRef} onScroll={handleTopScroll} className="overflow-x-auto overflow-y-hidden" style={{ height: 14 }}>
              <div style={{ width: scrollWidth, height: 1 }} />
            </div>
            <div ref={tableScrollRef} onScroll={handleTableScroll} className="overflow-auto flex-1 border rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-2 w-6" />
                    <th className="text-left p-2 font-medium whitespace-nowrap">Data</th>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Evento</th>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Nome</th>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Email</th>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Telefone</th>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Valor</th>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Qtd</th>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Produtos</th>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Categorias</th>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Pagamento</th>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Histórico cliente</th>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Página de origem</th>
                    <th className="text-left p-2 font-medium whitespace-nowrap">UTM Source</th>
                    <th className="text-left p-2 font-medium whitespace-nowrap">UTM Campaign</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.length === 0 && (
                    <tr>
                      <td colSpan={COLUMN_COUNT} className="p-4 text-center text-muted-foreground">
                        Nenhum lead encontrado pra essa busca/filtro.
                      </td>
                    </tr>
                  )}
                  {filteredLeads.map((lead) => (
                    <Fragment key={lead.id}>
                      <tr className="border-t border-border">
                        <td className="p-2 align-top">
                          <button
                            type="button"
                            onClick={() => setExpandedId((atual) => (atual === lead.id ? null : lead.id))}
                            className="text-muted-foreground hover:text-foreground"
                            title="Ver payload bruto recebido"
                          >
                            {expandedId === lead.id ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                        <td className="p-2 whitespace-nowrap text-muted-foreground">{formatDate(lead.created_at)}</td>
                        <td className="p-2 whitespace-nowrap">{lead.event_name || '-'}</td>
                        <td className="p-2 whitespace-nowrap">{lead.name || '-'}</td>
                        <td className="p-2 whitespace-nowrap">{lead.email || '-'}</td>
                        <td className="p-2 whitespace-nowrap">{lead.phone || '-'}</td>
                        <td className="p-2 whitespace-nowrap">
                          {lead.value ? `${lead.currency || ''} ${lead.value}`.trim() : '-'}
                        </td>
                        <td className="p-2 whitespace-nowrap">{lead.num_items ?? '-'}</td>
                        <td className="p-2 whitespace-nowrap" title={(lead.product_ids || []).join(', ')}>
                          {(lead.content_name || []).join(', ') || (lead.product_ids || []).join(', ') || '-'}
                        </td>
                        <td className="p-2 whitespace-nowrap">{(lead.content_category || []).join(', ') || '-'}</td>
                        <td className="p-2 whitespace-nowrap">{lead.payment_method || '-'}</td>
                        <td className="p-2 whitespace-nowrap">
                          {lead.customer_total_orders ? `${lead.customer_total_orders}x · R$ ${lead.customer_total_order_value}` : '-'}
                        </td>
                        <td className="p-2 whitespace-nowrap max-w-[220px] truncate" title={lead.page_url || ''}>
                          {lead.page_url || '-'}
                        </td>
                        <td className="p-2 whitespace-nowrap">{lead.utm_source || '-'}</td>
                        <td className="p-2 whitespace-nowrap">{lead.utm_campaign || '-'}</td>
                      </tr>
                      {expandedId === lead.id && (
                        <tr className="border-t border-border bg-muted/40">
                          <td colSpan={COLUMN_COUNT} className="p-3">
                            <p className="text-[11px] text-muted-foreground mb-1">Payload bruto recebido no webhook:</p>
                            <pre className="text-[11px] bg-background rounded-md p-3 overflow-x-auto max-h-[300px] whitespace-pre-wrap">
                              {JSON.stringify(lead.raw_payload, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
