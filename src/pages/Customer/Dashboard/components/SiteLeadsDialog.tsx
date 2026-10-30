import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Loader2, Download, Search, ChevronDown, ChevronRight, X, Columns3 } from 'lucide-react';
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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@evoapi/design-system';
import { sitesService, type Site, type SiteLeadSubmission } from '@/services/sites/sitesService';

const ALL = '__all__';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  site: Site | null;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const ageFromBirthDate = (birthDate: string | null): number | null => {
  if (!birthDate) return null;
  const parsed = new Date(birthDate);
  if (Number.isNaN(parsed.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - parsed.getFullYear();
  const beforeBirthday = now.getMonth() < parsed.getMonth() || (now.getMonth() === parsed.getMonth() && now.getDate() < parsed.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 && age < 130 ? age : null;
};

const csvEscape = (value: string) => `"${(value || '').replace(/"/g, '""')}"`;
const join = (values: string[] | null | undefined) => (values && values.length > 0 ? values.join(', ') : '');
const dash = (value: string | number | null | undefined) => (value === null || value === undefined || value === '' ? '-' : value);

// Uma coluna = {label, csv, cell}. A ordem segue a mesma ordem dos
// parâmetros da URL da tag "Google Sheet relatorio de compra" do GTM
// (ver Sites::WebhookPayloadParser) — pedido explícito do usuário: TODA
// coluna que a planilha tem precisa aparecer na tabela, não só no CSV/no
// payload expandido. Config-driven (array + map) em vez de JSX repetido
// pra cabeçalho/corpo/CSV nunca ficarem fora de sincronia.
const COLUMNS: Array<{
  key: string;
  label: string;
  csv: (lead: SiteLeadSubmission) => string;
  cell: (lead: SiteLeadSubmission) => ReactNode;
}> = [
  { key: 'data', label: 'Data', csv: (l) => formatDate(l.created_at), cell: (l) => <span className="text-muted-foreground">{formatDate(l.created_at)}</span> },
  { key: 'evento', label: 'Evento', csv: (l) => l.event_name || '', cell: (l) => dash(l.event_name) },
  { key: 'order_id', label: 'Order ID', csv: (l) => l.transaction_id || '', cell: (l) => dash(l.transaction_id) },
  { key: 'first_name', label: 'First Name', csv: (l) => l.first_name || '', cell: (l) => dash(l.first_name) },
  { key: 'last_name', label: 'Last Name', csv: (l) => l.last_name || '', cell: (l) => dash(l.last_name) },
  { key: 'email', label: 'Email', csv: (l) => l.email || '', cell: (l) => dash(l.email) },
  { key: 'phone', label: 'Phone', csv: (l) => l.phone || '', cell: (l) => dash(l.phone) },
  { key: 'value', label: 'Value', csv: (l) => l.value || '', cell: (l) => dash(l.value) },
  { key: 'content_name', label: 'Content Name', csv: (l) => join(l.content_name), cell: (l) => dash(join(l.content_name)) },
  { key: 'gender', label: 'Gender', csv: (l) => l.gender || '', cell: (l) => dash(l.gender) },
  { key: 'age', label: 'Age', csv: (l) => (ageFromBirthDate(l.birth_date) ?? '').toString(), cell: (l) => dash(ageFromBirthDate(l.birth_date)) },
  { key: 'db', label: 'DB', csv: (l) => l.birth_date || '', cell: (l) => dash(l.birth_date) },
  { key: 'country', label: 'Country', csv: (l) => l.address_country || '', cell: (l) => dash(l.address_country) },
  { key: 'state', label: 'State', csv: (l) => l.address_state || '', cell: (l) => dash(l.address_state) },
  { key: 'zip', label: 'Zip', csv: (l) => l.address_zip || '', cell: (l) => dash(l.address_zip) },
  { key: 'city', label: 'City', csv: (l) => l.address_city || '', cell: (l) => dash(l.address_city) },
  { key: 'external_id', label: 'External ID', csv: (l) => l.external_id || '', cell: (l) => dash(l.external_id) },
  { key: 'content_type', label: 'Content Type', csv: (l) => l.content_type || '', cell: (l) => dash(l.content_type) },
  { key: 'content_ids', label: 'Content IDs', csv: (l) => join(l.product_ids), cell: (l) => dash(join(l.product_ids)) },
  { key: 'currency', label: 'Currency', csv: (l) => l.currency || '', cell: (l) => dash(l.currency) },
  { key: 'fbp', label: 'x-fb-ck-fbp', csv: (l) => l.fbp || '', cell: (l) => dash(l.fbp) },
  { key: 'fbc', label: 'x-fb-ck-fbc', csv: (l) => l.fbc || '', cell: (l) => dash(l.fbc) },
  { key: 'fpc', label: 'First Party Collection', csv: (l) => l.first_party_collection || '', cell: (l) => dash(l.first_party_collection) },
  { key: 'event_time', label: 'Event Time', csv: (l) => formatDate(l.created_at), cell: (l) => <span className="text-muted-foreground">{formatDate(l.created_at)}</span> },
  { key: 'action_source', label: 'Action Source', csv: (l) => l.action_source || '', cell: (l) => dash(l.action_source) },
  { key: 'content_category', label: 'Content Category', csv: (l) => join(l.content_category), cell: (l) => dash(join(l.content_category)) },
  { key: 'num_items', label: 'Num Items', csv: (l) => (l.num_items ?? '').toString(), cell: (l) => dash(l.num_items) },
  { key: 'campaign_id', label: 'Campaign ID', csv: (l) => l.utm_id || '', cell: (l) => dash(l.utm_id) },
  { key: 'campaign_source', label: 'Campaign Source', csv: (l) => l.utm_source || '', cell: (l) => dash(l.utm_source) },
  { key: 'campaign_medium', label: 'Campaign Medium', csv: (l) => l.utm_medium || '', cell: (l) => dash(l.utm_medium) },
  { key: 'campaign_campaign', label: 'Campaign Campaign', csv: (l) => l.utm_campaign || '', cell: (l) => dash(l.utm_campaign) },
  { key: 'campaign_term', label: 'Campaign Term', csv: (l) => l.utm_term || '', cell: (l) => dash(l.utm_term) },
  { key: 'campaign_content', label: 'Campaign Content', csv: (l) => l.utm_content || '', cell: (l) => dash(l.utm_content) },
  { key: 'gclid', label: 'gclid', csv: (l) => l.gclid || '', cell: (l) => dash(l.gclid) },
  { key: 'pagamento', label: 'Pagamento', csv: (l) => l.payment_method || '', cell: (l) => dash(l.payment_method) },
  { key: 'cupom', label: 'Cupom', csv: (l) => l.coupon || '', cell: (l) => dash(l.coupon) },
  {
    key: 'historico_cliente',
    label: 'Histórico cliente',
    csv: (l) => (l.customer_total_orders ? `${l.customer_total_orders}x / R$ ${l.customer_total_order_value}` : ''),
    cell: (l) => (l.customer_total_orders ? `${l.customer_total_orders}x · R$ ${l.customer_total_order_value}` : '-'),
  },
  { key: 'pagina_origem', label: 'Página de origem', csv: (l) => l.page_url || '', cell: (l) => <span className="max-w-[220px] inline-block truncate align-bottom" title={l.page_url || ''}>{dash(l.page_url)}</span> },
];

// Colunas visíveis por padrão pra quem nunca configurou nada — as mais
// úteis no dia a dia de LP/geração de lead. Site de e-commerce tem outro
// conjunto relevante (Order ID, Value, Content Name/IDs, Cupom...),
// configurável pelo próprio usuário no botão "Colunas" — por isso a
// preferência é persistida POR SITE (ver COLUMN_PREFS_KEY), não global.
const DEFAULT_VISIBLE_KEYS = ['data', 'evento', 'first_name', 'last_name', 'email', 'phone', 'campaign_source', 'campaign_campaign', 'pagina_origem'];

const COLUMN_PREFS_KEY = (siteId: string) => `site-leads-columns-${siteId}`;

function loadVisibleKeys(siteId: string): Set<string> {
  try {
    const raw = localStorage.getItem(COLUMN_PREFS_KEY(siteId));
    if (raw) return new Set(JSON.parse(raw));
  } catch {
    // localStorage pode falhar (aba anônima, bloqueio de site) — cai no padrão.
  }
  return new Set(DEFAULT_VISIBLE_KEYS);
}

// "Ver leads" de um Site — mesmo padrão visual/estrutural de
// LeadFormLeadsDialog.tsx (dialog full-screen, busca livre, filtro de
// data, exportar CSV com BOM, linha expansível). Todas as colunas que a
// tag "Google Sheet relatorio de compra" do GTM manda EXISTEM aqui (ver
// COLUMNS acima, na mesma ordem) — mas cada site escolhe quais ver no dia
// a dia (botão "Colunas"), já que e-commerce e landing page de captura de
// lead usam campos bem diferentes; a escolha fica salva por site
// (loadVisibleKeys/COLUMN_PREFS_KEY), não é a mesma pra todos.
export function SiteLeadsDialog({ open, onOpenChange, site }: Props) {
  const [leads, setLeads] = useState<SiteLeadSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [eventFilter, setEventFilter] = useState(ALL);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set(DEFAULT_VISIBLE_KEYS));

  useEffect(() => {
    if (open && site) setVisibleKeys(loadVisibleKeys(site.id));
  }, [open, site]);

  const toggleColumn = (key: string) => {
    if (!site) return;
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        localStorage.setItem(COLUMN_PREFS_KEY(site.id), JSON.stringify(Array.from(next)));
      } catch {
        // per-viewer apenas — ignora se localStorage não estiver disponível.
      }
      return next;
    });
  };

  const visibleColumns = useMemo(() => COLUMNS.filter((c) => visibleKeys.has(c.key)), [visibleKeys]);
  const visibleColumnCount = visibleColumns.length + 1; // +1 pelo botão de expandir

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
  }, [loading, visibleColumns]);

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
    const header = COLUMNS.map((c) => c.label);
    const rows = filteredLeads.map((lead) => COLUMNS.map((c) => c.csv(lead)));
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
                {' · '}
                <span title="Use o botão 'Colunas' pra escolher quais aparecem, ou o botão à esquerda de cada linha pra ver o payload bruto completo.">
                  {visibleColumns.length} de {COLUMNS.length} colunas
                </span>
              </p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Columns3 className="w-3.5 h-3.5 mr-1.5" /> Colunas
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-[70vh] overflow-y-auto">
                  <DropdownMenuLabel>Colunas exibidas neste site</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {COLUMNS.map((c) => (
                    <DropdownMenuCheckboxItem
                      key={c.key}
                      checked={visibleKeys.has(c.key)}
                      onCheckedChange={() => toggleColumn(c.key)}
                      onSelect={(e: Event) => e.preventDefault()}
                    >
                      {c.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
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
                    {visibleColumns.map((c) => (
                      <th key={c.key} className="text-left p-2 font-medium whitespace-nowrap">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.length === 0 && (
                    <tr>
                      <td colSpan={visibleColumnCount} className="p-4 text-center text-muted-foreground">
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
                        {visibleColumns.map((c) => (
                          <td key={c.key} className="p-2 whitespace-nowrap">
                            {c.cell(lead)}
                          </td>
                        ))}
                      </tr>
                      {expandedId === lead.id && (
                        <tr className="border-t border-border bg-muted/40">
                          <td colSpan={visibleColumnCount} className="p-3">
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
