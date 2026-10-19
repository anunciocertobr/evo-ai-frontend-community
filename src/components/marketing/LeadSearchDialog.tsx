import { Fragment, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Search, Film, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Input } from '@evoapi/design-system';
import { metaCreationService, LeadSearchResult } from '@/services/marketing/metaCreationService';
import LeadDetailsCell from '@/components/marketing/LeadDetailsCell';
import { formatPublicoAlvo } from '@/components/marketing/leadDetails';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageId: string;
  pageName: string;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const PLATFORM_LABEL: Record<string, string> = {
  ig: 'Instagram',
  fb: 'Facebook',
  msn: 'Messenger',
  wa: 'WhatsApp',
};

// Busca por telefone/nome/email sem saber de antemão qual formulário —
// vai direto na Graph API (não existe banco local completo pra buscar, ver
// comentário no service), varrendo todos os formulários da página. Por ser
// cara (várias chamadas HTTP), dispara só por botão/Enter, nunca a cada
// tecla digitada.
export default function LeadSearchDialog({ open, onOpenChange, pageId, pageName }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LeadSearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<LeadSearchResult | null>(null);
  // Linha expandida: IDs, criativo completo e direcionamento do anúncio.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fieldNames = useMemo(() => {
    const names: string[] = [];
    (results || []).forEach((lead) => {
      lead.field_data?.forEach((f) => {
        if (!names.includes(f.name)) names.push(f.name);
      });
    });
    return names;
  }, [results]);

  const fieldValue = (lead: LeadSearchResult, name: string) => lead.field_data?.find((f) => f.name === name)?.values?.[0] || '';

  const runSearch = () => {
    if (!query.trim()) return;
    setLoading(true);
    setResults(null);
    metaCreationService
      .searchLeadsInPage(pageId, query.trim())
      .then(setResults)
      .catch(() => toast.error('Falha ao buscar os leads dessa Página.'))
      .finally(() => setLoading(false));
  };

  const openCreative = (lead: LeadSearchResult) => {
    if (lead.criativo_video) {
      setPlayingVideo(lead);
    } else if (lead.criativo_link) {
      window.open(lead.criativo_link, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          onOpenChange(o);
          if (!o) {
            setQuery('');
            setResults(null);
          }
        }}
      >
        <DialogContent className="w-screen max-w-[100vw] sm:max-w-[100vw] h-screen max-h-[100vh] rounded-none flex flex-col">
          <DialogHeader>
            <DialogTitle>Buscar lead — {pageName}</DialogTitle>
            <DialogDescription>
              Digite telefone, nome ou e-mail pra descobrir de qual formulário dessa Página o lead veio. Varre todos
              os formulários direto na Meta — pode levar alguns segundos.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && runSearch()}
                placeholder="Telefone, nome ou e-mail..."
                className="pl-8"
                autoFocus
              />
            </div>
            <Button onClick={runSearch} disabled={loading || !query.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buscar'}
            </Button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && results !== null && results.length === 0 && (
            <p className="text-sm text-muted-foreground py-10 text-center">Nenhum lead encontrado pra essa busca.</p>
          )}

          {!loading && results !== null && results.length > 0 && (
            <div className="overflow-auto flex-1 border rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-2 w-6" />
                    <th className="text-left p-2 font-medium whitespace-nowrap">Formulário</th>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Data</th>
                    {fieldNames.map((name) => (
                      <th key={name} className="text-left p-2 font-medium whitespace-nowrap">
                        {name}
                      </th>
                    ))}
                    <th className="text-left p-2 font-medium whitespace-nowrap">Campanha</th>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Criativo</th>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Origem</th>
                    <th className="text-left p-2 font-medium whitespace-nowrap">Público-alvo do anúncio</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((lead) => (
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
                      <td className="p-2 whitespace-nowrap font-medium">{lead.form_name}</td>
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
                    {expandedId === lead.id && <LeadDetailsCell lead={lead} colSpan={fieldNames.length + 6} />}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
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
