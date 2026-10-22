import { Fragment, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Download, Film, ExternalLink, Search, ChevronDown, ChevronRight, X, Pencil } from 'lucide-react';
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
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@evoapi/design-system';
import { metaCreationService, LeadFormLead } from '@/services/marketing/metaCreationService';
import type { PipelineStatusForLead } from '@/services/admin/metaLeadFormsService';
import LeadDetailsCell from '@/components/marketing/LeadDetailsCell';
import { formatPublicoAlvo, LEAD_CSV_EXTRA_COLUMNS, leadCsvExtraValues } from '@/components/marketing/leadDetails';
import MetaLeadSubmissionDetailDialog from '@/components/marketing/MetaLeadSubmissionDetailDialog';

const ALL = '__all__';

// Extrai pares {id,nome} únicos de um campo do lead, na ordem em que
// aparecem — usado pros três seletores em cascata abaixo (Campanha >
// Conjunto > Anúncio, cada um só com as opções que de fato existem dentro
// do nível acima já escolhido).
function uniqueOptions(leads: LeadFormLead[], idKey: 'campaign_id' | 'adset_id' | 'ad_id', nameKey: 'campaign_name' | 'adset_name' | 'ad_name') {
  const seen = new Map<string, string>();
  leads.forEach((lead) => {
    const id = lead[idKey];
    if (!id || seen.has(id)) return;
    seen.set(id, lead[nameKey] || id);
  });
  return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageId: string;
  formId: string;
  formName: string;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const PLATFORM_LABEL: Record<string, string> = {
  ig: 'Instagram',
  fb: 'Facebook',
  msn: 'Messenger',
  wa: 'WhatsApp',
};

const csvEscape = (value: string) => `"${(value || '').replace(/"/g, '""')}"`;

export default function LeadFormLeadsDialog({ open, onOpenChange, pageId, formId, formName }: Props) {
  const [leads, setLeads] = useState<LeadFormLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  // Linha expandida: mostra IDs, criativo completo e direcionamento do
  // anúncio (o que não cabe nas colunas da tabela).
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filtros: data vem de `created_time` de cada lead; campanha/conjunto/
  // anúncio são IDs reais (não nome, pra não misturar duas campanhas com o
  // mesmo nome) e ficam em cascata — trocar a campanha reseta conjunto/
  // anúncio se a seleção atual não existir mais dentro da nova campanha.
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [campaignFilter, setCampaignFilter] = useState(ALL);
  const [adsetFilter, setAdsetFilter] = useState(ALL);
  const [adFilter, setAdFilter] = useState(ALL);

  // Status/fase do card ligado no Kanban, por leadgen_id — buscado em lote
  // depois da lista carregar (não vem junto da Graph API, é consulta
  // separada no nosso banco). Lead sem entrada aqui = nunca passou pelo
  // CRM (histórico anterior à integração, ou formulário sem mapeamento).
  const [pipelineStatus, setPipelineStatus] = useState<Record<string, PipelineStatusForLead>>({});
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);

  const loadPipelineStatus = (leadIds: string[]) => {
    metaCreationService
      .getPipelineStatusForLeads(leadIds)
      .then(setPipelineStatus)
      .catch(() => {
        /* não trava a tela por isso — a coluna "Fase" só fica vazia */
      });
  };

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setCampaignFilter(ALL);
    setAdsetFilter(ALL);
    setAdFilter(ALL);
    setPipelineStatus({});
    setLoading(true);
    metaCreationService
      .listFormLeads(pageId, formId)
      .then((data) => {
        setLeads(data);
        loadPipelineStatus(data.map((l) => l.id));
      })
      .catch(() => toast.error('Falha ao buscar os leads desse formulário.'))
      .finally(() => setLoading(false));
  }, [open, pageId, formId]);

  const leadsInCampaign = useMemo(
    () => (campaignFilter === ALL ? leads : leads.filter((l) => l.campaign_id === campaignFilter)),
    [leads, campaignFilter],
  );
  const leadsInAdset = useMemo(
    () => (adsetFilter === ALL ? leadsInCampaign : leadsInCampaign.filter((l) => l.adset_id === adsetFilter)),
    [leadsInCampaign, adsetFilter],
  );

  const campaignOptions = useMemo(() => uniqueOptions(leads, 'campaign_id', 'campaign_name'), [leads]);
  const adsetOptions = useMemo(() => uniqueOptions(leadsInCampaign, 'adset_id', 'adset_name'), [leadsInCampaign]);
  const adOptions = useMemo(() => uniqueOptions(leadsInAdset, 'ad_id', 'ad_name'), [leadsInAdset]);

  // Se trocar a campanha e o conjunto/anúncio selecionado não pertencer mais
  // a ela, volta pra "Todos" em vez de ficar com um filtro que não bate com
  // nenhum lead (telona vazia sem explicação).
  useEffect(() => {
    if (adsetFilter !== ALL && !adsetOptions.some((o) => o.id === adsetFilter)) setAdsetFilter(ALL);
  }, [adsetOptions, adsetFilter]);
  useEffect(() => {
    if (adFilter !== ALL && !adOptions.some((o) => o.id === adFilter)) setAdFilter(ALL);
  }, [adOptions, adFilter]);

  const hasActiveFilters = dateFrom || dateTo || campaignFilter !== ALL || adsetFilter !== ALL || adFilter !== ALL;
  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setCampaignFilter(ALL);
    setAdsetFilter(ALL);
    setAdFilter(ALL);
  };

  // Cada formulário tem suas próprias perguntas — as colunas são os nomes de
  // campo que de fato aparecem nos leads recebidos, na ordem em que surgem.
  const fieldNames = useMemo(() => {
    const names: string[] = [];
    leads.forEach((lead) => {
      lead.field_data?.forEach((f) => {
        if (!names.includes(f.name)) names.push(f.name);
      });
    });
    return names;
  }, [leads]);

  const fieldValue = (lead: LeadFormLead, name: string) =>
    lead.field_data?.find((f) => f.name === name)?.values?.[0] || '';

  // Busca livre: cada formulário tem perguntas diferentes (nome/telefone/
  // email não são campos fixos, ver fieldNames acima), então filtra por
  // qualquer valor de resposta do lead, além de campanha/conjunto/anúncio —
  // combinada (E lógico) com data/campanha/conjunto/anúncio selecionados.
  const filteredLeads = useMemo(() => {
    const term = search.trim().toLowerCase();
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59`) : null;

    return leads.filter((lead) => {
      if (campaignFilter !== ALL && lead.campaign_id !== campaignFilter) return false;
      if (adsetFilter !== ALL && lead.adset_id !== adsetFilter) return false;
      if (adFilter !== ALL && lead.ad_id !== adFilter) return false;

      const createdAt = new Date(lead.created_time);
      if (from && createdAt < from) return false;
      if (to && createdAt > to) return false;

      if (!term) return true;
      const campos = [
        ...(lead.field_data?.flatMap((f) => f.values) || []),
        lead.campaign_name,
        lead.adset_name,
        lead.ad_name,
      ];
      return campos.some((valor) => valor?.toLowerCase().includes(term));
    });
  }, [leads, search, dateFrom, dateTo, campaignFilter, adsetFilter, adFilter]);

  // Clique sempre leva pro post real na Meta — passar o mouse já mostra o
  // criativo grande (HoverCard abaixo), então o clique não precisa mais
  // abrir um player de vídeo embutido aqui dentro.
  const openCreative = (lead: LeadFormLead) => {
    if (lead.criativo_link) window.open(lead.criativo_link, '_blank', 'noopener,noreferrer');
  };

  const downloadCsv = () => {
    const header = ['Data', ...fieldNames, 'Anúncio', 'Conjunto', 'Campanha', 'Criativo', ...LEAD_CSV_EXTRA_COLUMNS];
    const rows = filteredLeads.map((lead) => [
      formatDate(lead.created_time),
      ...fieldNames.map((name) => fieldValue(lead, name)),
      lead.ad_name || '',
      lead.adset_name || '',
      lead.campaign_name || '',
      lead.criativo_nome || '',
      ...leadCsvExtraValues(lead),
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
    // BOM pra Excel reconhecer UTF-8 (sem isso, acentos quebram ao abrir).
    const blob = new Blob([`${String.fromCharCode(0xfeff)}${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${formName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-screen max-w-[100vw] sm:max-w-[100vw] h-screen max-h-[100vh] rounded-none flex flex-col">
        <DialogHeader>
          <DialogTitle>Leads — {formName}</DialogTitle>
          <DialogDescription>
            Todos os leads já recebidos por esse formulário, buscados direto na Meta (histórico completo).
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : leads.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">Nenhum lead recebido ainda por esse formulário.</p>
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
                <Label className="text-xs">Campanha</Label>
                <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                  <SelectTrigger className="w-[180px]">
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
                  <SelectTrigger className="w-[180px]">
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
                  <SelectTrigger className="w-[180px]">
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
            <div className="overflow-auto flex-1 border rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-2 w-6" />
                    <th className="text-left p-2 font-medium whitespace-nowrap">Data</th>
                    {fieldNames.map((name) => (
                      <th key={name} className="text-left p-2 font-medium whitespace-nowrap">
                        {name}
                      </th>
                    ))}
                    <th className="text-left p-2 font-medium whitespace-nowrap">Campanha</th>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Conjunto</th>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Anúncio</th>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Criativo</th>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Origem</th>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Público-alvo do anúncio</th>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Fase</th>
                    <th className="p-2 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.length === 0 && (
                    <tr>
                      <td colSpan={fieldNames.length + 10} className="p-4 text-center text-muted-foreground">
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
                            title="Ver IDs, criativo e direcionamento"
                          >
                            {expandedId === lead.id ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                        <td className="p-2 whitespace-nowrap text-muted-foreground">{formatDate(lead.created_time)}</td>
                        {fieldNames.map((name) => (
                          <td key={name} className="p-2 whitespace-nowrap">
                            {fieldValue(lead, name)}
                          </td>
                        ))}
                        <td className="p-2 whitespace-nowrap">
                          <span>{lead.campaign_name || '-'}</span>
                          {lead.campaign_id && (
                            <span className="block text-[10px] font-mono text-muted-foreground">{lead.campaign_id}</span>
                          )}
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <span>{lead.adset_name || '-'}</span>
                          {lead.adset_id && (
                            <span className="block text-[10px] font-mono text-muted-foreground">{lead.adset_id}</span>
                          )}
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <span>{lead.ad_name || '-'}</span>
                          {lead.ad_id && <span className="block text-[10px] font-mono text-muted-foreground">{lead.ad_id}</span>}
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          {lead.criativo_imagem ? (
                            <HoverCard openDelay={150} closeDelay={0}>
                              <HoverCardTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => openCreative(lead)}
                                  disabled={!lead.criativo_link}
                                  className="relative inline-block w-10 h-10 rounded overflow-hidden border border-border group disabled:cursor-default"
                                  title={lead.criativo_link ? 'Ver o post na Meta' : lead.criativo_nome || 'Criativo'}
                                >
                                  <img src={lead.criativo_imagem} alt={lead.criativo_nome || ''} className="w-full h-full object-cover" />
                                  {lead.criativo_link && (
                                    <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
                                      <ExternalLink className="w-4 h-4 text-white opacity-0 group-hover:opacity-100" />
                                    </span>
                                  )}
                                </button>
                              </HoverCardTrigger>
                              <HoverCardContent className="w-auto p-2" side="right">
                                <div className="relative">
                                  <img
                                    src={lead.criativo_imagem}
                                    alt={lead.criativo_nome || ''}
                                    className="max-w-[320px] max-h-[320px] rounded object-contain"
                                  />
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
                                {lead.criativo_link && (
                                  <p className="text-[11px] mt-1 text-primary">Clique na miniatura pra abrir o post ↗</p>
                                )}
                              </HoverCardContent>
                            </HoverCard>
                          ) : (
                            <span className="text-muted-foreground">{lead.criativo_nome || '-'}</span>
                          )}
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          {lead.platform ? PLATFORM_LABEL[lead.platform] || lead.platform : '-'}
                          {lead.is_organic !== undefined && (
                            <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded ${lead.is_organic ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                              {lead.is_organic ? 'Orgânico' : 'Pago'}
                            </span>
                          )}
                        </td>
                        <td className="p-2 whitespace-nowrap" title={formatPublicoAlvo(lead.publico_alvo)?.detalhe}>
                          <button
                            type="button"
                            onClick={() => setExpandedId((atual) => (atual === lead.id ? null : lead.id))}
                            className="text-left hover:underline decoration-dotted"
                          >
                            {formatPublicoAlvo(lead.publico_alvo)?.resumo || '-'}
                          </button>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          {pipelineStatus[lead.id]?.pipeline_stage_name ? (
                            <>
                              <span>{pipelineStatus[lead.id].pipeline_stage_name}</span>
                              <span className="block text-[10px] text-muted-foreground">{pipelineStatus[lead.id].pipeline_name}</span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">
                              {pipelineStatus[lead.id]?.status === 'unmapped_form' ? 'Sem formulário mapeado' : '—'}
                            </span>
                          )}
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setEditingLeadId(lead.id)}
                            className="text-muted-foreground hover:text-foreground"
                            title="Ver/editar colunas adicionais"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                      {expandedId === lead.id && <LeadDetailsCell lead={lead} colSpan={fieldNames.length + 10} />}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </DialogContent>

      <MetaLeadSubmissionDetailDialog
        open={Boolean(editingLeadId)}
        onOpenChange={(o) => !o && setEditingLeadId(null)}
        leadgenId={editingLeadId}
        onUpdated={() => loadPipelineStatus(leads.map((l) => l.id))}
      />
    </Dialog>
  );
}
