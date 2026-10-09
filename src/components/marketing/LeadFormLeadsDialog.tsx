import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Download, Film, ExternalLink } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@evoapi/design-system';
import { metaCreationService, LeadFormLead } from '@/services/marketing/metaCreationService';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageId: string;
  formId: string;
  formName: string;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const csvEscape = (value: string) => `"${(value || '').replace(/"/g, '""')}"`;

export default function LeadFormLeadsDialog({ open, onOpenChange, pageId, formId, formName }: Props) {
  const [leads, setLeads] = useState<LeadFormLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<LeadFormLead | null>(null);

  useEffect(() => {
    if (!open) return;
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

  const openCreative = (lead: LeadFormLead) => {
    if (lead.criativo_video) {
      setPlayingVideo(lead);
    } else if (lead.criativo_link) {
      window.open(lead.criativo_link, '_blank', 'noopener,noreferrer');
    }
  };

  const downloadCsv = () => {
    const header = ['Data', ...fieldNames, 'Anúncio', 'Conjunto', 'Campanha', 'Criativo'];
    const rows = leads.map((lead) => [
      formatDate(lead.created_time),
      ...fieldNames.map((name) => fieldValue(lead, name)),
      lead.ad_name || '',
      lead.adset_name || '',
      lead.campaign_name || '',
      lead.criativo_nome || '',
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
      <DialogContent className="w-[95vw] max-w-[95vw] h-[92vh] max-h-[92vh] flex flex-col">
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
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{leads.length} lead(s)</p>
              <Button size="sm" onClick={downloadCsv}>
                <Download className="w-3.5 h-3.5 mr-1.5" /> Baixar CSV
              </Button>
            </div>
            <div className="overflow-auto flex-1 border rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
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
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id} className="border-t border-border">
                      <td className="p-2 whitespace-nowrap text-muted-foreground">{formatDate(lead.created_time)}</td>
                      {fieldNames.map((name) => (
                        <td key={name} className="p-2 whitespace-nowrap">
                          {fieldValue(lead, name)}
                        </td>
                      ))}
                      <td className="p-2 whitespace-nowrap">{lead.campaign_name || '-'}</td>
                      <td className="p-2 whitespace-nowrap">{lead.adset_name || '-'}</td>
                      <td className="p-2 whitespace-nowrap">{lead.ad_name || '-'}</td>
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
                    </tr>
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
