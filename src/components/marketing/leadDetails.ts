import { LeadFormLead, LeadTargetingContext } from '@/services/marketing/metaCreationService';

export const PLACEMENT_PLATFORM_LABEL: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  messenger: 'Messenger',
  whatsapp: 'WhatsApp',
  audience_network: 'Audience Network',
};

const juntar = (values?: string[]): string | null => {
  const itens = (values || []).filter((v) => v && v.trim().length > 0);
  return itens.length > 0 ? itens.join(', ') : null;
};

const rotuloPlataforma = (linha: string) => {
  const [plataforma, ...resto] = linha.split(':');
  const nome = PLACEMENT_PLATFORM_LABEL[plataforma.trim()] || plataforma.trim();
  return resto.length > 0 ? `${nome}: ${resto.join(':')}` : nome;
};

// Resumo do público-alvo CONFIGURADO no anúncio que trouxe o lead — não é
// dado do indivíduo (ver comentário em LeadTargetingContext no service).
// `resumo` vai na célula da tabela e `detalhe` no tooltip dela.
export const formatPublicoAlvo = (alvo?: LeadTargetingContext) => {
  if (!alvo) return null;
  const idade = alvo.idade_min || alvo.idade_max ? `${alvo.idade_min ?? '—'}-${alvo.idade_max ?? '—'} anos` : null;
  const resumo = [alvo.orcamento, idade, alvo.generos].filter(Boolean).join(' · ');
  const detalhe = [
    alvo.orcamento ? `Orçamento: ${alvo.orcamento}` : null,
    alvo.localizacoes?.length ? `Local: ${alvo.localizacoes.join(', ')}` : null,
    juntar(alvo.publicos_salvos) ? `Público salvo: ${juntar(alvo.publicos_salvos)}` : null,
    juntar(alvo.publicos_personalizados) ? `Público personalizado: ${juntar(alvo.publicos_personalizados)}` : null,
    juntar(alvo.publicos_semelhantes) ? `Público semelhante: ${juntar(alvo.publicos_semelhantes)}` : null,
    alvo.direcionamento?.length ? `Direcionamento: ${alvo.direcionamento.join(' · ')}` : null,
    alvo.posicionamento?.length
      ? `Posicionamento: ${alvo.posicionamento.map(rotuloPlataforma).join(' · ')}`
      : null,
    alvo.plataformas?.length
      ? `Plataformas: ${alvo.plataformas.map((p) => PLACEMENT_PLATFORM_LABEL[p] || p).join(', ')}`
      : null,
    alvo.dispositivos?.length ? `Dispositivos: ${alvo.dispositivos.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join('\n');
  return { resumo: resumo || '-', detalhe };
};

export interface LeadDetailItem {
  label: string;
  valor: string;
}

export interface LeadDetailSection {
  titulo: string;
  itens: LeadDetailItem[];
}

const item = (label: string, valor?: string | null): LeadDetailItem | null =>
  valor && valor.trim().length > 0 ? { label, valor } : null;

const identificacao = (nome?: string, id?: string): string | null => {
  if (nome && id && nome !== id) return `${nome}\n${id}`;
  return nome || id || null;
};

// Seções da linha expandida de um lead: tudo que a Meta expõe sobre o
// anúncio/conjunto que gerou a conversão (IDs, criativo completo e
// direcionamento configurado), no shape devolvido pelo backend.
export const leadDetailSections = (lead: LeadFormLead): LeadDetailSection[] => {
  const secoes: LeadDetailSection[] = [];

  const anuncio = [
    item('Campanha', identificacao(lead.campaign_name, lead.campaign_id)),
    item('Conjunto', identificacao(lead.adset_name, lead.adset_id)),
    item('Anúncio', identificacao(lead.ad_name, lead.ad_id)),
  ].filter((i): i is LeadDetailItem => i !== null);
  if (anuncio.length > 0) secoes.push({ titulo: 'Anúncio', itens: anuncio });

  const criativo = [
    item('Texto principal', lead.criativo_texto_principal),
    item('Título', lead.criativo_titulo),
    item('Descrição', lead.criativo_descricao),
    item('Criativo', lead.criativo_nome),
  ].filter((i): i is LeadDetailItem => i !== null);
  if (criativo.length > 0) secoes.push({ titulo: 'Criativo', itens: criativo });

  const alvo = lead.publico_alvo;
  if (alvo) {
    const idade =
      alvo.idade_min || alvo.idade_max ? `${alvo.idade_min ?? '—'}-${alvo.idade_max ?? '—'} anos` : null;
    const direcionamento = [
      item('Orçamento', alvo.orcamento),
      item('Idade', idade),
      item('Gênero', alvo.generos),
      item('Local', juntar(alvo.localizacoes)),
      item('Público salvo', juntar(alvo.publicos_salvos)),
      item('Público personalizado', juntar(alvo.publicos_personalizados)),
      item('Público semelhante', juntar(alvo.publicos_semelhantes)),
      item('Direcionamento detalhado', juntar(alvo.direcionamento)),
      item('Posicionamento', juntar(alvo.posicionamento?.map(rotuloPlataforma))),
      item('Plataformas', juntar(alvo.plataformas?.map((p) => PLACEMENT_PLATFORM_LABEL[p] || p))),
      item('Dispositivos', juntar(alvo.dispositivos)),
    ].filter((i): i is LeadDetailItem => i !== null);
    if (direcionamento.length > 0) secoes.push({ titulo: 'Direcionamento do anúncio', itens: direcionamento });
  }

  return secoes;
};

// Colunas extras do CSV (IDs + criativo + direcionamento) — mantidas ao lado
// das seções pra nunca divergirem do que a tela mostra.
export const LEAD_CSV_EXTRA_COLUMNS = [
  'ID campanha',
  'ID conjunto',
  'ID anúncio',
  'Texto principal',
  'Título',
  'Descrição',
  'Orçamento',
  'Idade',
  'Gênero',
  'Local',
  'Direcionamento detalhado',
  'Público salvo',
  'Público personalizado',
  'Público semelhante',
  'Posicionamento',
  'Dispositivos',
];

export const leadCsvExtraValues = (lead: LeadFormLead): string[] => {
  const alvo = lead.publico_alvo;
  const idade = alvo && (alvo.idade_min || alvo.idade_max) ? `${alvo.idade_min ?? ''}-${alvo.idade_max ?? ''}` : '';
  return [
    lead.campaign_id || '',
    lead.adset_id || '',
    lead.ad_id || '',
    lead.criativo_texto_principal || '',
    lead.criativo_titulo || '',
    lead.criativo_descricao || '',
    alvo?.orcamento || '',
    idade,
    alvo?.generos || '',
    (alvo?.localizacoes || []).join('; '),
    (alvo?.direcionamento || []).join('; '),
    (alvo?.publicos_salvos || []).join('; '),
    (alvo?.publicos_personalizados || []).join('; '),
    (alvo?.publicos_semelhantes || []).join('; '),
    (alvo?.posicionamento || []).join('; '),
    (alvo?.dispositivos || []).join('; '),
  ];
};
