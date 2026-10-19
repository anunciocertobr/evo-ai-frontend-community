import { Fragment, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Download, Film, ExternalLink, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Input } from '@evoapi/design-system';
import { metaCreationService, LeadFormLead } from '@/services/marketing/metaCreationService';
import LeadDetailsCell from '@/components/marketing/LeadDetailsCell';
import { formatPublicoAlvo, LEAD_CSV_EXTRA_COLUMNS, leadCsvExtraValues } from '@/components/marketing/leadDetails';

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
  const [playingVideo, setPlayingVideo] = useState<LeadFormLead | null>(null);
  const [search, setSearch] = useState('');
  // Linha expandida: mostra IDs, criativo completo e direcionamento do
  // anúncio (o que não cabe nas colunas da tabela).
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setLoading(true);
    metaCreationService
      .listFormLeads(pageId, formId)
      .then(setLeads)
      .catch(() => toast.error('Falha ao buscar os leads desse formulário.'))
      .finally(() => setLoading(false));
  }, [open, pageId, formId]);

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
  // qualquer valor de resposta do lead, além de campanha/conjunto/anúncio.
  const filteredLeads = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return leads;
    return leads.filter((lead) => {
      const campos = [
        ...(lead.field_data?.flatMap((f) => f.values) || []),
        lead.campaign_name,
        lead.adset_name,
        lead.ad_name,
      ];
      return campos.some((valor) => valor?.toLowerCase().includes(term));
    });
  }, [leads, search]);

  const openCreative = (lead: LeadFormLead) => {
    if (lead.criativo_video) {
      setPlayingVideo(lead);
    } else if (lead.criativo_link) {
      window.open(lead.criativo_link, '_blank', 'noopener,noreferrer');
    }
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
    <>
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
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.length === 0 && (
                    <tr>
                      <td colSpan={fieldNames.length + 8} className="p-4 text-center text-muted-foreground">
                        Nenhum lead encontrado pra essa busca.
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
                            <button
                              type="button"
                              onClick={() => openCreative(lead)}
                              disabled={!lead.criativo_video && !lead.criativo_link}
                              className="relative inline-block w-10 h-10 rounded overflow-hidden border border-border group disabled:cursor-default"
                              title={lead.criativo_nome || 'Ver criativo'}
                            >
                              <img src={lead.criativo_imagem} alt={lead.criativo_nome || ''} className="w-full h-full object-cover" />
                              {(lead.criativo_video || lead.criativo_link) && (
                                <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
                                  {lead.criativo_video ? (
                                    <Film className="w-4 h-4 text-white opacity-0 group-hover:opacity-100" />
                                  ) : (
                                    <ExternalLink className="w-4 h-4 text-white opacity-0 group-hover:opacity-100" />
                                  )}
                                </span>
                              )}
                            </button>
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
                      </tr>
                      {expandedId === lead.id && <LeadDetailsCell lead={lead} colSpan={fieldNames.length + 8} />}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </DialogContent>
      </Dialog>

      <Dialog open={Boolean(playingVideo)} onOpenChange={(o) => !o && setPlayingVideo(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="truncate">{playingVideo?.criativo_nome || 'Criativo'}</DialogTitle>
          </DialogHeader>
          {playingVideo?.criativo_video && (
            <video controls autoPlay src={playingVideo.criativo_video} className="w-full rounded-md bg-black" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
