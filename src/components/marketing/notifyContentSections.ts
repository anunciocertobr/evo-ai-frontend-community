// Seções configuráveis da mensagem de notificação de lead Meta (WhatsApp).
// As chaves espelham Meta::LeadAds::WhatsappNotifierService::CONTENT_SECTIONS
// no backend — manter em sincronia. Fica separado do componente pra respeitar
// a regra react-refresh/only-export-components (arquivo de componente só
// exporta componente).

export interface NotifyContentSection {
  key: string;
  label: string;
}

export interface NotifyContentGroup {
  title: string;
  sections: NotifyContentSection[];
}

export const NOTIFY_CONTENT_GROUPS: NotifyContentGroup[] = [
  {
    title: 'Anúncio',
    sections: [
      { key: 'entities', label: 'Campanha / Conjunto / Anúncio (nome + ID)' },
    ],
  },
  {
    title: 'Criativo',
    sections: [
      { key: 'creative_image', label: 'Imagem do anúncio' },
      { key: 'creative_text', label: 'Texto principal' },
      { key: 'creative_title', label: 'Título' },
      { key: 'creative_description', label: 'Descrição' },
    ],
  },
  {
    title: 'Direcionamento do anúncio',
    sections: [
      { key: 'budget', label: 'Orçamento' },
      { key: 'age_gender', label: 'Idade e gênero' },
      { key: 'location', label: 'Localização' },
      { key: 'audiences', label: 'Públicos (salvo / personalizado / semelhante)' },
      { key: 'audience_detail', label: 'Direcionamento detalhado (interesses, comportamentos…)' },
      { key: 'platforms', label: 'Plataformas (Facebook, Instagram…)' },
      { key: 'placements', label: 'Posicionamento (feed, stories, reels…)' },
      { key: 'devices', label: 'Dispositivos' },
    ],
  },
  {
    title: 'Respostas',
    sections: [
      { key: 'answers', label: 'Respostas do formulário (inclui perguntas personalizadas)' },
    ],
  },
];

export const ALL_NOTIFY_CONTENT_SECTIONS = NOTIFY_CONTENT_GROUPS.flatMap((g) =>
  g.sections.map((s) => s.key),
);
