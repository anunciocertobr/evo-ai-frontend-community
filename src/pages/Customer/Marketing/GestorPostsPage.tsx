import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Heart, MessageCircle, Users, Image as ImageIcon, X, Send, Plus, Upload, FolderOpen, Calendar, CalendarDays, RotateCcw, Phone, Youtube, Instagram, Facebook, Trash2, Settings as SettingsIcon, Bookmark, Target, Share2, Eye, UserPlus, Clock, Play, Layers, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import flatpickr from 'flatpickr';
import { Portuguese } from 'flatpickr/dist/l10n/pt.js';
import 'flatpickr/dist/flatpickr.min.css';
import { Button, Badge, Card, CardContent, Checkbox } from '@evoapi/design-system';
import { BaseHeader } from '@/components/base';
import { gestorPostsService } from '@/services/marketing/gestorPostsService';
import type {
  SocialChannelOption,
  SocialChannelType,
  InstagramAccountInfo,
  InstagramMedia,
  InstagramStory,
  InstagramComment,
  PublicationPlatform,
  PublicationContentType,
  ScheduledPostItem,
  ScheduledPostStatus,
  WhatsappStatusChannelOption,
  WhatsappStatusType,
  YoutubePrivacyStatus,
  FacebookAccountInfo,
  FacebookPost,
  YoutubeChannelInfo,
  YoutubeVideoItem,
} from '@/types/marketing/gestorPosts';

type GalleryPlatform = 'instagram' | 'facebook' | 'youtube';
type MediaTypeChoice = 'image' | 'video' | 'carousel' | 'text' | 'audio' | '';

const CONTENT_TYPE_LABELS: Record<PublicationContentType, string> = {
  feed: 'Feed',
  stories: 'Stories',
  reels: 'Reels',
};

// Ordem igual ao modelo original: Stories, Feed, Reels.
const FORMAT_ORDER: PublicationContentType[] = ['stories', 'feed', 'reels'];

// Menu de Opções (engrenagem) do modelo original — quais métricas aparecem
// no grid, ordenação e filtro por tipo de mídia. Persistido no
// localStorage (o original usava cookie).
const GALLERY_SETTINGS_STORAGE_KEY = 'gestorPostsGallerySettings';

interface GallerySettings {
  isAudioEnabled: boolean;
  isInfoVisible: boolean;
  isDateVisible: boolean;
  isLikesVisible: boolean;
  isCommentsVisible: boolean;
  isReachVisible: boolean;
  isSavedVisible: boolean;
  isInteractionsVisible: boolean;
  isSharesVisible: boolean;
  isVisitsVisible: boolean;
  isFollowsVisible: boolean;
  isWatchTimeVisible: boolean;
  sortOrder: string;
  mediaTypeFilter: 'all' | 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
}

const DEFAULT_GALLERY_SETTINGS: GallerySettings = {
  isAudioEnabled: false,
  isInfoVisible: false,
  isDateVisible: false,
  isLikesVisible: false,
  isCommentsVisible: false,
  isReachVisible: false,
  isSavedVisible: false,
  isInteractionsVisible: false,
  isSharesVisible: false,
  isVisitsVisible: false,
  isFollowsVisible: false,
  isWatchTimeVisible: false,
  sortOrder: 'date-desc',
  mediaTypeFilter: 'all',
};

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'date-desc', label: 'Mais recentes' },
  { value: 'date-asc', label: 'Mais antigos' },
  { value: 'likes-desc', label: 'Mais curtidas' },
  { value: 'likes-asc', label: 'Menos curtidas' },
  { value: 'comments-desc', label: 'Mais comentários' },
  { value: 'comments-asc', label: 'Menos comentários' },
  { value: 'reach-desc', label: 'Maior alcance' },
  { value: 'reach-asc', label: 'Menor alcance' },
  { value: 'saved-desc', label: 'Mais salvos' },
  { value: 'saved-asc', label: 'Menos salvos' },
  { value: 'interactions-desc', label: 'Mais interações' },
  { value: 'interactions-asc', label: 'Menos interações' },
  { value: 'shares-desc', label: 'Mais compartilhamentos' },
  { value: 'shares-asc', label: 'Menos compartilhamentos' },
  { value: 'visits-desc', label: 'Mais visitas ao perfil' },
  { value: 'visits-asc', label: 'Menos visitas ao perfil' },
  { value: 'follows-desc', label: 'Mais seguidores' },
  { value: 'follows-asc', label: 'Menos seguidores' },
  { value: 'watch_time-desc', label: 'Maior tempo médio' },
  { value: 'watch_time-asc', label: 'Menor tempo médio' },
];

const MONTH_LABELS = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

// Chaves booleanas de gallerySettings — igual ao modelo original, os botões
// "Ativar Todos"/"Ativar Tudo" alternam (liga tudo se algo estiver desligado,
// desliga tudo se já estiver tudo ligado) em vez de simplesmente forçar true.
type BooleanSettingKey =
  | 'isAudioEnabled'
  | 'isInfoVisible'
  | 'isDateVisible'
  | 'isLikesVisible'
  | 'isCommentsVisible'
  | 'isReachVisible'
  | 'isSavedVisible'
  | 'isInteractionsVisible'
  | 'isSharesVisible'
  | 'isVisitsVisible'
  | 'isFollowsVisible'
  | 'isWatchTimeVisible';

const VISUALIZATION_KEYS: BooleanSettingKey[] = ['isAudioEnabled', 'isInfoVisible', 'isDateVisible'];
const METRIC_KEYS: BooleanSettingKey[] = [
  'isLikesVisible',
  'isCommentsVisible',
  'isReachVisible',
  'isSavedVisible',
  'isInteractionsVisible',
  'isSharesVisible',
  'isVisitsVisible',
  'isFollowsVisible',
  'isWatchTimeVisible',
];

const SCHEDULED_STATUS_LABELS: Record<ScheduledPostStatus, string> = {
  scheduled: 'Agendado',
  executing: 'Publicando',
  completed: 'Publicado',
  failed: 'Falhou',
  cancelled: 'Cancelado',
};

function toDatetimeLocalMin() {
  const d = new Date(Date.now() + 5 * 60 * 1000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatNumber(n?: number) {
  return new Intl.NumberFormat('pt-BR').format(n || 0);
}

function insightValue(media: InstagramMedia, name: string): number | null {
  const insight = media.insights?.data?.find((i) => i.name === name);
  return insight?.values?.[0]?.value ?? null;
}

interface DestinationChecklistProps {
  title: string;
  icon: React.ReactNode;
  items: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  emptyLabel: string;
  disabled?: boolean;
}

function DestinationChecklist({ title, icon, items, selected, onToggle, emptyLabel, disabled }: DestinationChecklistProps) {
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
        {icon} {title}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400">{emptyLabel}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5 bg-gray-50 border border-gray-200 rounded-lg p-2 max-h-28 overflow-y-auto">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(item.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none ${
                selected.includes(item.id)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GestorPostsPage() {
  const [channels, setChannels] = useState<SocialChannelOption[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<SocialChannelOption | null>(null);
  const [loadingChannels, setLoadingChannels] = useState(true);

  const [accountInfo, setAccountInfo] = useState<InstagramAccountInfo | null>(null);
  const [media, setMedia] = useState<InstagramMedia[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);

  const [selectedMedia, setSelectedMedia] = useState<InstagramMedia | null>(null);
  const [selectedFacebookPost, setSelectedFacebookPost] = useState<FacebookPost | null>(null);
  const [comments, setComments] = useState<InstagramComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [sendingReply, setSendingReply] = useState(false);
  const [confirmDeleteMediaOpen, setConfirmDeleteMediaOpen] = useState(false);
  const [deletingMedia, setDeletingMedia] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCaption, setNewCaption] = useState('');
  const [newFormats, setNewFormats] = useState<Record<PublicationContentType, boolean>>({
    feed: true,
    stories: false,
    reels: false,
  });
  // Lista única de arquivos enviados — igual ao modelo original
  // (uploadedFiles), usada tanto pra post único (só o índice 0 é publicado)
  // quanto carrossel (todos), com reordenar/remover individual.
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadedPreviewUrls, setUploadedPreviewUrls] = useState<string[]>([]);
  // "Tipo de Mídia" — Imagem/Vídeo/Carrossel, escolha única. Texto/Áudio só
  // aparecem quando WhatsApp é o único destino marcado (Status do WhatsApp
  // aceita esses dois formatos além de imagem/vídeo).
  const [mediaType, setMediaType] = useState<MediaTypeChoice>('');
  const [newIsCarousel, setNewIsCarousel] = useState(false);
  // Thumbnail customizada — só aparece pra Tipo de Mídia = Vídeo, igual ao
  // modelo original ("Subir Thumbnail"). Vira cover_url num Reels do
  // Instagram; ignorada silenciosamente pros outros formatos/plataformas.
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const [newIsScheduled, setNewIsScheduled] = useState(false);
  const [newScheduledFor, setNewScheduledFor] = useState('');
  const [creating, setCreating] = useState(false);
  const [createProgress, setCreateProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // "Subir Pasta" com estrutura Cliente/Data/Post/Formato — igual ao modelo
  // original: filtra por data, agrupa por cliente e por post, e cada post
  // pode ter um configuracao.txt (plataformas/contas) e um legenda*.txt
  // (legenda) que são lidos e aplicados automaticamente.
  const [allFolderFiles, setAllFolderFiles] = useState<File[]>([]);
  const [showFolderOptions, setShowFolderOptions] = useState(false);
  const [folderFilterToday, setFolderFilterToday] = useState(true);
  const [clientNames, setClientNames] = useState<string[]>([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [postNames, setPostNames] = useState<string[]>([]);
  const [selectedPost, setSelectedPost] = useState('');

  // Destinos do post: quais contas/instâncias/canais devem receber a
  // publicação — cada lista aceita múltiplas seleções, igual ao painel
  // original (galeria de criativos.txt), pra permitir publicar em várias
  // contas do Instagram, páginas do Facebook e instâncias do WhatsApp de
  // uma vez só (o YouTube ainda só suporta uma conta Google conectada por
  // vez nesta versão do CRM).
  const [destInstagramIds, setDestInstagramIds] = useState<string[]>([]);
  const [destFacebookIds, setDestFacebookIds] = useState<string[]>([]);
  const [destWhatsappIds, setDestWhatsappIds] = useState<string[]>([]);
  const [destYoutube, setDestYoutube] = useState(false);
  // Passo "Plataforma(s)" do modelo original: liga/desliga a visibilidade da
  // lista de contas de cada rede — desligar uma plataforma limpa as contas
  // selecionadas nela.
  const [platformEnabled, setPlatformEnabled] = useState({
    instagram: false,
    facebook: false,
    whatsapp: false,
    youtube: false,
  });

  const [showScheduledModal, setShowScheduledModal] = useState(false);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPostItem[]>([]);
  const [loadingScheduled, setLoadingScheduled] = useState(false);
  const [scheduledActionId, setScheduledActionId] = useState<string | null>(null);

  // WhatsApp/YouTube não têm mais modais próprios no menu principal — viraram
  // destinos selecionáveis dentro do "Criar Post" (igual ao modelo original,
  // que só tem "Criar Post" e "Calendário" na tela principal). Esses estados
  // continuam porque a checklist de destinos e o publishWhatsappJob/
  // publishYoutubeJob do Criar Post dependem deles.
  const [whatsappChannels, setWhatsappChannels] = useState<WhatsappStatusChannelOption[]>([]);
  const [youtubeConnected, setYoutubeConnected] = useState<boolean | null>(null);
  // Sem seletor de privacidade no Criar Post unificado (o original nunca
  // teve upload de YouTube na tela principal) — sempre publica como
  // "não listado", igual ao padrão que já era usado antes.
  const youtubePrivacy: YoutubePrivacyStatus = 'unlisted';

  const facebookChannels = channels.filter((c) => c.channel_type === ('Channel::FacebookPage' as SocialChannelType));
  // WhatsApp é o único destino marcado — só nesse caso faz sentido oferecer
  // Texto/Áudio no Tipo de Mídia (Status do WhatsApp aceita os dois; os
  // outros destinos, não).
  const whatsappOnlySelected =
    platformEnabled.whatsapp && !platformEnabled.instagram && !platformEnabled.facebook && !platformEnabled.youtube;

  const [gallerySettings, setGallerySettings] = useState<GallerySettings>(() => {
    try {
      const raw = localStorage.getItem(GALLERY_SETTINGS_STORAGE_KEY);
      if (raw) return { ...DEFAULT_GALLERY_SETTINGS, ...JSON.parse(raw) };
    } catch {
      // localStorage indisponível ou JSON inválido — usa os padrões.
    }
    return DEFAULT_GALLERY_SETTINGS;
  });
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(GALLERY_SETTINGS_STORAGE_KEY, JSON.stringify(gallerySettings));
    } catch {
      // ignora — não é crítico persistir preferências de visualização.
    }
  }, [gallerySettings]);

  const updateGallerySetting = <K extends keyof GallerySettings>(key: K, value: GallerySettings[K]) => {
    setGallerySettings((prev) => ({ ...prev, [key]: value }));
  };

  const toggleAllSettings = (keys: BooleanSettingKey[]) => {
    setGallerySettings((prev) => {
      const allChecked = keys.every((k) => prev[k]);
      const next = { ...prev };
      keys.forEach((k) => {
        next[k] = !allChecked;
      });
      return next;
    });
  };

  // Filtro por data (ícone de calendário) — período rápido, mês do ano
  // corrente, ou intervalo específico.
  const [showDateFilterModal, setShowDateFilterModal] = useState(false);
  const [dateRangeStart, setDateRangeStart] = useState('');
  const [dateRangeEnd, setDateRangeEnd] = useState('');
  const [activeMonthFilter, setActiveMonthFilter] = useState<number | null>(null);

  const applyQuickDateRange = (range: 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'all') => {
    setActiveMonthFilter(null);
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;
    switch (range) {
      case 'today':
        start = new Date();
        end = new Date();
        break;
      case 'yesterday':
        start = new Date(now);
        start.setDate(start.getDate() - 1);
        end = new Date(start);
        break;
      case 'week': {
        const day = now.getDay() === 0 ? 6 : now.getDay() - 1;
        start = new Date(now);
        start.setDate(start.getDate() - day);
        end = new Date();
        break;
      }
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        break;
      case 'all':
      default:
        start = null;
        end = null;
    }
    const toInputDate = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    };
    setDateRangeStart(start ? toInputDate(start) : '');
    setDateRangeEnd(end ? toInputDate(end) : '');
    setShowDateFilterModal(false);
  };

  const applyMonthFilter = (month: number | null) => {
    setActiveMonthFilter(month);
    setDateRangeStart('');
    setDateRangeEnd('');
    setShowDateFilterModal(false);
  };

  // Calendário inline (flatpickr) — igual ao modelo original: só os dias com
  // posts ficam selecionáveis/destacados ("has-posts"), clicar num dia filtra
  // pra aquele dia exato e fecha o modal. Estendido (não existia no modelo
  // original, onde publicados e agendados eram views mutuamente exclusivas):
  // dias com posts agendados ganham a classe "has-scheduled", numa cor
  // diferente, e um dia pode ter as duas classes ao mesmo tempo.
  const calendarContainerRef = useRef<HTMLDivElement>(null);
  const postDates = useMemo(
    () => Array.from(new Set(media.map((m) => m.timestamp?.slice(0, 10)).filter((d): d is string => Boolean(d)))),
    [media],
  );
  const scheduledDates = useMemo(
    () =>
      Array.from(
        new Set(scheduledPosts.map((p) => p.scheduled_for?.slice(0, 10)).filter((d): d is string => Boolean(d))),
      ),
    [scheduledPosts],
  );
  const calendarEnabledDates = useMemo(
    () => Array.from(new Set([...postDates, ...scheduledDates])),
    [postDates, scheduledDates],
  );

  useEffect(() => {
    if (!showDateFilterModal || !calendarContainerRef.current || calendarEnabledDates.length === 0) return;

    const instance = flatpickr(calendarContainerRef.current, {
      inline: true,
      enable: calendarEnabledDates,
      dateFormat: 'Y-m-d',
      locale: Portuguese,
      monthSelectorType: 'static',
      onDayCreate: (_selectedDates, _dateStr, _fp, dayElem) => {
        const d = dayElem.dateObj;
        const pad = (n: number) => String(n).padStart(2, '0');
        const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        if (postDates.includes(key)) dayElem.classList.add('has-posts');
        if (scheduledDates.includes(key)) dayElem.classList.add('has-scheduled');
      },
      onChange: (selectedDates) => {
        const selected = selectedDates[0];
        if (!selected) return;
        const pad = (n: number) => String(n).padStart(2, '0');
        const key = `${selected.getFullYear()}-${pad(selected.getMonth() + 1)}-${pad(selected.getDate())}`;
        setActiveMonthFilter(null);
        setDateRangeStart(key);
        setDateRangeEnd(key);
        setShowDateFilterModal(false);
      },
    });

    return () => instance.destroy();
  }, [showDateFilterModal, calendarEnabledDates, postDates, scheduledDates]);

  const filteredSortedMedia = useMemo(() => {
    let list = [...media];

    if (gallerySettings.mediaTypeFilter !== 'all') {
      list = list.filter((m) => m.media_type === gallerySettings.mediaTypeFilter);
    }

    if (dateRangeStart && dateRangeEnd) {
      const start = new Date(dateRangeStart);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateRangeEnd);
      end.setHours(23, 59, 59, 999);
      list = list.filter((m) => {
        if (!m.timestamp) return false;
        const d = new Date(m.timestamp);
        return d >= start && d <= end;
      });
    } else if (activeMonthFilter !== null) {
      list = list.filter((m) => {
        if (!m.timestamp) return false;
        return new Date(m.timestamp).getMonth() === activeMonthFilter;
      });
    }

    const [sortKey, sortDir] = gallerySettings.sortOrder.split('-');
    const order = sortDir === 'desc' ? -1 : 1;
    list.sort((a, b) => {
      let valA = 0;
      let valB = 0;
      switch (sortKey) {
        case 'date':
          valA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          valB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          break;
        case 'likes':
          valA = a.like_count || 0;
          valB = b.like_count || 0;
          break;
        case 'comments':
          valA = a.comments_count || 0;
          valB = b.comments_count || 0;
          break;
        case 'reach':
          valA = insightValue(a, 'reach') || 0;
          valB = insightValue(b, 'reach') || 0;
          break;
        case 'saved':
          valA = insightValue(a, 'saved') || 0;
          valB = insightValue(b, 'saved') || 0;
          break;
        case 'interactions':
          valA = insightValue(a, 'total_interactions') || 0;
          valB = insightValue(b, 'total_interactions') || 0;
          break;
        case 'shares':
          valA = insightValue(a, 'shares') || 0;
          valB = insightValue(b, 'shares') || 0;
          break;
        case 'visits':
          valA = insightValue(a, 'profile_visits') || 0;
          valB = insightValue(b, 'profile_visits') || 0;
          break;
        case 'follows':
          valA = insightValue(a, 'follows') || 0;
          valB = insightValue(b, 'follows') || 0;
          break;
        case 'watch_time':
          valA = insightValue(a, 'ig_reels_avg_watch_time') || 0;
          valB = insightValue(b, 'ig_reels_avg_watch_time') || 0;
          break;
        default:
          return 0;
      }
      if (valA < valB) return -1 * order;
      if (valA > valB) return 1 * order;
      return 0;
    });

    return list;
  }, [media, gallerySettings.mediaTypeFilter, gallerySettings.sortOrder, dateRangeStart, dateRangeEnd, activeMonthFilter]);

  const [galleryPlatform, setGalleryPlatform] = useState<GalleryPlatform>('instagram');

  // "Destaques" não existe na Graph API pra apps de terceiros — o mais
  // próximo que dá pra mostrar de verdade são os Stories ativos (só ficam
  // disponíveis por 24h, mesmo que salvos como destaque no perfil).
  const [instagramView, setInstagramView] = useState<'posts' | 'stories'>('posts');
  const [stories, setStories] = useState<InstagramStory[]>([]);
  const [loadingStories, setLoadingStories] = useState(false);

  const [selectedFacebookChannel, setSelectedFacebookChannel] = useState<SocialChannelOption | null>(null);
  const [facebookAccountInfo, setFacebookAccountInfo] = useState<FacebookAccountInfo | null>(null);
  const [facebookMedia, setFacebookMedia] = useState<FacebookPost[]>([]);
  const [loadingFacebookGallery, setLoadingFacebookGallery] = useState(false);

  const [youtubeAccountInfo, setYoutubeAccountInfo] = useState<YoutubeChannelInfo | null>(null);
  const [youtubeVideos, setYoutubeVideos] = useState<YoutubeVideoItem[]>([]);
  const [loadingYoutubeGallery, setLoadingYoutubeGallery] = useState(false);
  const [youtubeGalleryError, setYoutubeGalleryError] = useState<string | null>(null);

  const toggleInDest = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const toggleFormat = (format: PublicationContentType) => {
    setNewFormats((prev) => ({ ...prev, [format]: !prev[format] }));
  };

  const togglePlatformEnabled = (key: 'instagram' | 'facebook' | 'whatsapp' | 'youtube') => {
    setPlatformEnabled((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (!next[key]) {
        if (key === 'instagram') setDestInstagramIds([]);
        if (key === 'facebook') setDestFacebookIds([]);
        if (key === 'whatsapp') setDestWhatsappIds([]);
        if (key === 'youtube') setDestYoutube(false);
      }
      return next;
    });
  };

  const selectMediaType = (type: MediaTypeChoice) => {
    setMediaType(type);
    setNewIsCarousel(type === 'carousel');
    if (type !== 'video') setThumbFile(null);
    if (type === 'text' || type === 'audio') setUploadedFiles([]);
  };

  const handleAudioFileSelect = (file: File | null) => {
    setUploadedFiles(file ? [file] : []);
  };

  // Preview de cada arquivo enviado se regenera sozinho sempre que a lista
  // muda — evita ter que revogar/recriar URLs manualmente em cada handler.
  useEffect(() => {
    const urls = uploadedFiles.map((f) => URL.createObjectURL(f));
    setUploadedPreviewUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [uploadedFiles]);

  // "Subir Arquivos" — soma aos arquivos já enviados (não substitui), igual
  // ao modelo original, e some com as opções de pasta (não é uma seleção
  // organizada por cliente/post).
  const addUploadedFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const incoming = Array.from(fileList).filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (incoming.length === 0) return;
    setShowFolderOptions(false);
    setUploadedFiles((prev) => [...prev, ...incoming]);
    if (!mediaType) {
      setMediaType(incoming.length > 1 || uploadedFiles.length > 0 ? 'carousel' : incoming[0].type.startsWith('video/') ? 'video' : 'image');
      setNewIsCarousel(incoming.length > 1 || uploadedFiles.length > 0);
    }
  };

  const removeUploadedFileAt = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const moveUploadedFile = (index: number, direction: -1 | 1) => {
    setUploadedFiles((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  // --- "Subir Pasta": estrutura Cliente/AAAA-MM-DD/NomeDoPost/FORMATO ---
  const getRelativePath = (file: File) =>
    ((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name).replace(/\\/g, '/');

  const applyConfigText = (text: string) => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const config: Record<string, string> = {};
    lines.forEach((line) => {
      const parts = line.split(':');
      if (parts.length < 2) return;
      config[parts[0].trim().toLowerCase()] = parts.slice(1).join(':').trim();
    });

    const enabled = { instagram: false, facebook: false, whatsapp: false, youtube: false };
    (Object.keys(enabled) as Array<keyof typeof enabled>).forEach((key) => {
      if ((config[key] || '').toLowerCase() === 'sim') enabled[key] = true;
    });
    setPlatformEnabled(enabled);

    const idsFor = (key: string) => (config[key] || '').split(',').map((s) => s.trim()).filter(Boolean);
    setDestInstagramIds(enabled.instagram ? idsFor('id_instagram') : []);
    setDestFacebookIds(enabled.facebook ? idsFor('id_facebook') : []);
    setDestWhatsappIds(enabled.whatsapp ? idsFor('id_whatsapp') : []);
    setDestYoutube(enabled.youtube);
  };

  const applyPostSelection = async (files: File[], client: string, postName: string | null) => {
    setNewCaption('');
    setNewFormats({ feed: false, stories: false, reels: false });
    setNewIsScheduled(false);
    setNewScheduledFor('');
    setPlatformEnabled({ instagram: false, facebook: false, whatsapp: false, youtube: false });
    setDestInstagramIds([]);
    setDestFacebookIds([]);
    setDestWhatsappIds([]);
    setDestYoutube(false);
    setThumbFile(null);

    const isMedia = (f: File) => f.type.startsWith('image/') || f.type.startsWith('video/');
    const matched = files
      .filter((f) => {
        const parts = getRelativePath(f).split('/');
        return parts[1] === client && (postName ? parts[3] === postName : true) && isMedia(f);
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    setUploadedFiles(matched);
    if (matched.length > 1) {
      setMediaType('carousel');
      setNewIsCarousel(true);
    } else if (matched.length === 1) {
      setMediaType(matched[0].type.startsWith('video/') ? 'video' : 'image');
      setNewIsCarousel(false);
    } else {
      setMediaType('');
      setNewIsCarousel(false);
    }

    const configFile = files.find((f) => {
      const parts = getRelativePath(f).split('/');
      return parts[1] === client && f.name.toLowerCase() === 'configuracao.txt';
    });
    if (configFile) {
      try {
        applyConfigText(await configFile.text());
      } catch {
        toast.error('Erro ao ler o arquivo de configuração.');
      }
    }

    const captionFile = files.find(
      (f) => postName && getRelativePath(f).includes(`/${postName}/`) && f.name.toLowerCase().startsWith('legenda'),
    );
    if (captionFile) {
      try {
        setNewCaption(await captionFile.text());
      } catch {
        toast.error('Erro ao ler o arquivo de legenda do post.');
      }
    }

    const firstFile = matched[0];
    if (firstFile) {
      const parts = getRelativePath(firstFile).split('/');
      if (parts.length >= 5) {
        const dateFolderName = parts[2];
        const formatKey = parts[4].toLowerCase() as PublicationContentType;
        if (formatKey === 'feed' || formatKey === 'stories' || formatKey === 'reels') {
          setNewFormats((prev) => ({ ...prev, [formatKey]: true }));
        }

        const dateMatch = dateFolderName.match(/(\d{2,4})[-./](\d{1,2})[-./](\d{2,4})/);
        if (dateMatch) {
          let year: number, month: number, day: number;
          if (dateMatch[1].length === 4) {
            year = parseInt(dateMatch[1], 10);
            month = parseInt(dateMatch[2], 10) - 1;
            day = parseInt(dateMatch[3], 10);
          } else {
            day = parseInt(dateMatch[1], 10);
            month = parseInt(dateMatch[2], 10) - 1;
            year = parseInt(dateMatch[3], 10);
          }
          const parsedDate = new Date(year, month, day, 12, 0, 0);
          if (!isNaN(parsedDate.getTime())) {
            const pad = (n: number) => String(n).padStart(2, '0');
            setNewIsScheduled(true);
            setNewScheduledFor(
              `${parsedDate.getFullYear()}-${pad(parsedDate.getMonth() + 1)}-${pad(parsedDate.getDate())}T${pad(parsedDate.getHours())}:${pad(parsedDate.getMinutes())}`,
            );
          }
        }
      }
    }
  };

  const updatePostSelectorFor = (client: string, files: File[]) => {
    const posts = Array.from(
      new Set(
        files
          .filter((f) => getRelativePath(f).split('/')[1] === client)
          .map((f) => getRelativePath(f).split('/')[3])
          .filter(Boolean),
      ),
    );
    setPostNames(posts);
    if (posts.length > 0) {
      setSelectedPost(posts[0]);
      applyPostSelection(files, client, posts[0]);
    } else {
      setSelectedPost('');
      applyPostSelection(files, client, null);
    }
  };

  const handleFolderInputChange = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    let files = Array.from(fileList);

    if (folderFilterToday) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      files = files.filter((f) => {
        const parts = getRelativePath(f).split('/');
        if (parts.length <= 2) return false;
        const m = parts[2].match(/(\d{4})[-./](\d{2})[-./](\d{2})/);
        if (!m) return false;
        const postDate = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
        postDate.setHours(0, 0, 0, 0);
        return postDate >= today;
      });
      if (files.length === 0) {
        toast.error('Nenhum post com data de hoje em diante encontrado.');
        setShowFolderOptions(false);
        return;
      }
    }

    setAllFolderFiles(files);
    setShowFolderOptions(true);

    const clients = Array.from(
      new Set(
        files
          .map((f) => {
            const parts = getRelativePath(f).split('/');
            return parts.length > 1 ? parts[1] : null;
          })
          .filter((x): x is string => Boolean(x)),
      ),
    );
    setClientNames(clients);

    if (clients.length > 0) {
      setSelectedClient(clients[0]);
      updatePostSelectorFor(clients[0], files);
    } else {
      setSelectedClient('');
      setPostNames([]);
      setSelectedPost('');
      applyPostSelection(files, '', null);
    }
  };

  const handleClientChange = (client: string) => {
    setSelectedClient(client);
    updatePostSelectorFor(client, allFolderFiles);
  };

  const handlePostChange = (post: string) => {
    setSelectedPost(post);
    applyPostSelection(allFolderFiles, selectedClient, post || null);
  };

  const resetCreateForm = () => {
    setNewCaption('');
    setNewFormats({ feed: true, stories: false, reels: false });
    setDestInstagramIds([]);
    setDestFacebookIds([]);
    setDestWhatsappIds([]);
    setDestYoutube(false);
    setPlatformEnabled({ instagram: false, facebook: false, whatsapp: false, youtube: false });
    setMediaType('');
    setNewIsCarousel(false);
    setUploadedFiles([]);
    setThumbFile(null);
    setCreateProgress(null);
    setNewIsScheduled(false);
    setNewScheduledFor('');
    setShowFolderOptions(false);
    setFolderFilterToday(true);
    setAllFolderFiles([]);
    setClientNames([]);
    setSelectedClient('');
    setPostNames([]);
    setSelectedPost('');
  };

  const openCreateModal = () => {
    setShowCreateModal(true);
    // Pré-carrega instâncias de WhatsApp e status do YouTube pra já mostrar
    // os destinos disponíveis assim que o usuário marcar essas plataformas.
    gestorPostsService
      .getWhatsappStatusChannels()
      .then(setWhatsappChannels)
      .catch(() => setWhatsappChannels([]));
    gestorPostsService
      .getYoutubeConnected()
      .then(setYoutubeConnected)
      .catch(() => setYoutubeConnected(false));
  };

  const loadScheduledPosts = useCallback(async () => {
    setLoadingScheduled(true);
    try {
      const data = await gestorPostsService.getScheduledPosts();
      setScheduledPosts(data);
    } catch {
      toast.error('Erro ao carregar posts agendados.');
    } finally {
      setLoadingScheduled(false);
    }
  }, []);

  const openScheduledModal = () => {
    setShowScheduledModal(true);
    loadScheduledPosts();
  };

  const handleCancelScheduled = async (id: string) => {
    setScheduledActionId(id);
    try {
      await gestorPostsService.cancelScheduledPost(id);
      toast.success('Agendamento cancelado.');
      loadScheduledPosts();
    } catch {
      toast.error('Erro ao cancelar agendamento.');
    } finally {
      setScheduledActionId(null);
    }
  };

  const handleRetryScheduled = async (id: string) => {
    setScheduledActionId(id);
    try {
      await gestorPostsService.retryScheduledPost(id);
      toast.success('Post reenviado para a fila de agendamento.');
      loadScheduledPosts();
    } catch {
      toast.error('Erro ao reenviar post agendado.');
    } finally {
      setScheduledActionId(null);
    }
  };

  const pollYoutubeUploadStatus = async (id: string) => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      try {
        const upload = await gestorPostsService.getYoutubeUpload(id);
        if (upload.status === 'published') {
          toast.success('Vídeo publicado no YouTube!');
          return;
        }
        if (upload.status === 'failed') {
          toast.error(`Falha ao publicar no YouTube: ${upload.error_message || 'erro desconhecido'}`);
          return;
        }
      } catch {
        return;
      }
    }
  };

  const pollPublicationStatus = async (id: string) => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      try {
        const publication = await gestorPostsService.getPublication(id);
        if (publication.status === 'published') {
          loadGallery();
          return;
        }
        if (publication.status === 'failed') {
          toast.error(`Falha ao publicar: ${publication.error_message || 'erro desconhecido'}`);
          return;
        }
      } catch {
        return;
      }
    }
  };

  const pollCarouselStatus = async (id: string) => {
    for (let attempt = 0; attempt < 15; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      try {
        const batch = await gestorPostsService.getCarouselBatch(id);
        if (batch.status === 'published') {
          loadGallery();
          return;
        }
        if (batch.status === 'failed') {
          toast.error(`Falha ao publicar carrossel: ${batch.error_message || 'erro desconhecido'}`);
          return;
        }
      } catch {
        return;
      }
    }
  };

  // Publica (ou agenda) numa única conta Instagram/Facebook. Chamada uma vez
  // por conta selecionada x formato marcado (Feed/Stories/Reels) — é assim
  // que a versão original conseguia postar em várias contas e formatos ao
  // mesmo tempo: disparando uma chamada por combinação em vez de uma única
  // chamada "faz tudo".
  const publishMetaJob = async (
    channel: SocialChannelOption,
    platforms: PublicationPlatform[],
    format: PublicationContentType,
  ) => {
    if (newIsCarousel) {
      const cards = uploadedFiles.slice(0, 10);
      const batch = await gestorPostsService.createCarouselBatch({
        caption: newCaption,
        platforms,
        total_cards: cards.length,
        channel_type: channel.channel_type,
        channel_id: channel.channel_id,
      });
      for (const file of cards) {
        await gestorPostsService.addCarouselCard(batch.id, file);
      }
      pollCarouselStatus(batch.id);
      return;
    }
    const file = uploadedFiles[0];
    if (!file) return;
    if (newIsScheduled) {
      await gestorPostsService.createScheduledPost({
        caption: newCaption,
        platforms,
        content_type: format,
        media: file,
        thumbnail: thumbFile || undefined,
        channel_type: channel.channel_type,
        channel_id: channel.channel_id,
        scheduled_for: new Date(newScheduledFor).toISOString(),
      });
      return;
    }
    const { id } = await gestorPostsService.createPublication({
      caption: newCaption,
      platforms,
      content_type: format,
      media: file,
      thumbnail: thumbFile || undefined,
      channel_type: channel.channel_type,
      channel_id: channel.channel_id,
    });
    pollPublicationStatus(id);
  };

  const publishWhatsappJob = async (channelId: string) => {
    if (mediaType === 'text') {
      await gestorPostsService.createWhatsappStatus({
        channel_id: channelId,
        type: 'text',
        content: newCaption.trim(),
      });
      return;
    }
    const file = uploadedFiles[0];
    if (!file) return;
    const type: WhatsappStatusType =
      mediaType === 'audio' ? 'audio' : file.type.startsWith('video/') ? 'video' : 'image';
    await gestorPostsService.createWhatsappStatus({
      channel_id: channelId,
      type,
      media: file,
      caption: newCaption.trim() || undefined,
    });
  };

  const publishYoutubeJob = async () => {
    const file = uploadedFiles[0];
    if (!file) return;
    const upload = await gestorPostsService.createYoutubeUpload({
      title: newCaption.trim() || 'Vídeo publicado via CRM',
      description: newCaption,
      privacy_status: youtubePrivacy,
      video: file,
    });
    pollYoutubeUploadStatus(upload.id);
  };

  const handleCreatePost = async () => {
    const formats = (Object.keys(newFormats) as PublicationContentType[]).filter((f) => newFormats[f]);
    const hasMeta = destInstagramIds.length > 0 || destFacebookIds.length > 0;
    const hasWhatsapp = destWhatsappIds.length > 0;
    const hasYoutube = destYoutube;

    const whatsappOnly = hasWhatsapp && !hasMeta && !hasYoutube;

    if (!hasMeta && !hasWhatsapp && !hasYoutube) {
      toast.error('Selecione ao menos uma plataforma e uma conta de destino.');
      return;
    }
    if (!mediaType) {
      toast.error(
        whatsappOnly
          ? 'Selecione o Tipo de Mídia (Imagem, Vídeo, Carrossel, Texto ou Áudio).'
          : 'Selecione o Tipo de Mídia (Imagem, Vídeo ou Carrossel).',
      );
      return;
    }
    if (hasMeta && !newIsCarousel && formats.length === 0) {
      toast.error('Selecione ao menos um formato (Feed, Stories ou Reels).');
      return;
    }
    if (whatsappOnly && mediaType === 'text') {
      if (!newCaption.trim()) {
        toast.error('Escreva o texto do status.');
        return;
      }
    } else if (newIsCarousel) {
      if (uploadedFiles.length < 2) {
        toast.error('Selecione ao menos 2 imagens para o carrossel.');
        return;
      }
      if (hasWhatsapp || hasYoutube) {
        toast.error('Carrossel só é suportado para Instagram/Facebook. Desmarque WhatsApp/YouTube ou desative o carrossel.');
        return;
      }
    } else if (uploadedFiles.length === 0) {
      toast.error(mediaType === 'audio' ? 'Selecione um arquivo de áudio.' : 'Selecione um arquivo de mídia.');
      return;
    }
    if (hasYoutube && (newIsCarousel || !uploadedFiles[0]?.type.startsWith('video/'))) {
      toast.error('Para postar no YouTube, selecione um único arquivo de vídeo (sem carrossel).');
      return;
    }
    if (newIsScheduled && (hasWhatsapp || hasYoutube)) {
      toast.error('Agendamento ainda não é suportado para WhatsApp ou YouTube — desmarque-os ou desative o agendamento.');
      return;
    }
    if (newIsScheduled && !newScheduledFor) {
      toast.error('Escolha a data e hora do agendamento.');
      return;
    }

    const jobs: { label: string; run: () => Promise<void> }[] = [];

    destInstagramIds.forEach((id) => {
      const channel = channels.find((c) => c.channel_id === id);
      if (!channel) return;
      if (newIsCarousel) {
        jobs.push({ label: `Instagram (@${channel.username})`, run: () => publishMetaJob(channel, ['instagram'], 'feed') });
      } else {
        formats.forEach((format) => {
          jobs.push({
            label: `Instagram (@${channel.username}) - ${CONTENT_TYPE_LABELS[format]}`,
            run: () => publishMetaJob(channel, ['instagram'], format),
          });
        });
      }
    });

    destFacebookIds.forEach((id) => {
      const channel = facebookChannels.find((c) => c.channel_id === id);
      if (!channel) return;
      if (newIsCarousel) {
        jobs.push({ label: `Facebook (@${channel.username})`, run: () => publishMetaJob(channel, ['facebook'], 'feed') });
      } else {
        formats.forEach((format) => {
          jobs.push({
            label: `Facebook (@${channel.username}) - ${CONTENT_TYPE_LABELS[format]}`,
            run: () => publishMetaJob(channel, ['facebook'], format),
          });
        });
      }
    });

    destWhatsappIds.forEach((id) => {
      const wa = whatsappChannels.find((c) => c.channel_id === id);
      jobs.push({ label: `WhatsApp (${wa?.name || id})`, run: () => publishWhatsappJob(id) });
    });

    if (hasYoutube) {
      jobs.push({ label: 'YouTube', run: publishYoutubeJob });
    }

    setCreating(true);
    let successCount = 0;
    let failureCount = 0;
    for (const [index, job] of jobs.entries()) {
      setCreateProgress(`(${index + 1}/${jobs.length}) Publicando: ${job.label}...`);
      try {
        await job.run();
        successCount += 1;
      } catch {
        failureCount += 1;
        toast.error(`Falha em: ${job.label}`);
      }
    }
    setCreateProgress(null);
    setCreating(false);

    if (failureCount === 0) {
      toast.success(
        newIsScheduled ? 'Post agendado com sucesso!' : `Publicado com sucesso em ${successCount} destino(s)!`,
      );
      setShowCreateModal(false);
      resetCreateForm();
    } else if (successCount > 0) {
      toast.error(`${successCount} publicado(s) com sucesso, ${failureCount} falharam.`);
    }
  };

  useEffect(() => {
    gestorPostsService
      .getChannels()
      .then((data) => {
        setChannels(data);
        if (data.length > 0) setSelectedChannel(data[0]);
      })
      .catch(() => toast.error('Erro ao carregar contas conectadas.'))
      .finally(() => setLoadingChannels(false));
  }, []);

  const loadGallery = useCallback(async () => {
    if (!selectedChannel) return;
    setLoadingGallery(true);
    try {
      const [info, mediaList] = await Promise.all([
        gestorPostsService.getAccountInfo(selectedChannel),
        gestorPostsService.getMedia(selectedChannel, 25),
      ]);
      setAccountInfo(info);
      setMedia(mediaList);
    } catch {
      toast.error('Erro ao carregar a galeria do Instagram.');
    } finally {
      setLoadingGallery(false);
    }
  }, [selectedChannel]);

  useEffect(() => {
    loadGallery();
  }, [loadGallery]);

  const loadStories = useCallback(async () => {
    if (!selectedChannel) return;
    setLoadingStories(true);
    try {
      const data = await gestorPostsService.getStories(selectedChannel);
      setStories(data);
    } catch {
      toast.error('Erro ao carregar os Stories ativos.');
    } finally {
      setLoadingStories(false);
    }
  }, [selectedChannel]);

  useEffect(() => {
    if (galleryPlatform === 'instagram' && instagramView === 'stories') loadStories();
  }, [galleryPlatform, instagramView, loadStories]);

  useEffect(() => {
    if (!selectedFacebookChannel && facebookChannels.length > 0) {
      setSelectedFacebookChannel(facebookChannels[0]);
    }
  }, [facebookChannels, selectedFacebookChannel]);

  const loadFacebookGallery = useCallback(async () => {
    if (!selectedFacebookChannel) return;
    setLoadingFacebookGallery(true);
    try {
      const [info, posts] = await Promise.all([
        gestorPostsService.getFacebookAccountInfo(selectedFacebookChannel),
        gestorPostsService.getFacebookMedia(selectedFacebookChannel, 25),
      ]);
      setFacebookAccountInfo(info);
      setFacebookMedia(posts);
    } catch {
      toast.error('Erro ao carregar a galeria do Facebook.');
    } finally {
      setLoadingFacebookGallery(false);
    }
  }, [selectedFacebookChannel]);

  useEffect(() => {
    if (galleryPlatform === 'facebook') loadFacebookGallery();
  }, [galleryPlatform, loadFacebookGallery]);

  const loadYoutubeGallery = useCallback(async () => {
    setLoadingYoutubeGallery(true);
    setYoutubeGalleryError(null);
    try {
      const [info, videos] = await Promise.all([
        gestorPostsService.getYoutubeAccountInfo(),
        gestorPostsService.getYoutubeVideos(25),
      ]);
      setYoutubeAccountInfo(info);
      setYoutubeVideos(videos);
    } catch (err) {
      const message =
        (err as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0] ||
        'Erro ao carregar a galeria do YouTube.';
      setYoutubeGalleryError(message);
    } finally {
      setLoadingYoutubeGallery(false);
    }
  }, []);

  useEffect(() => {
    if (galleryPlatform === 'youtube') loadYoutubeGallery();
  }, [galleryPlatform, loadYoutubeGallery]);

  const openMedia = async (item: InstagramMedia) => {
    setSelectedMedia(item);
    setComments([]);
    setLoadingComments(true);
    try {
      const data = await gestorPostsService.getComments(item.id, selectedChannel || undefined);
      setComments(data);
    } catch {
      toast.error('Erro ao carregar comentários.');
    } finally {
      setLoadingComments(false);
    }
  };

  const handleReply = async (commentId: string) => {
    if (!replyText.trim()) return;
    setSendingReply(true);
    try {
      await gestorPostsService.replyComment(commentId, replyText.trim(), selectedChannel || undefined);
      toast.success('Resposta enviada!');
      setReplyText('');
      setReplyingTo(null);
      if (selectedMedia) {
        const data = await gestorPostsService.getComments(selectedMedia.id, selectedChannel || undefined);
        setComments(data);
      }
    } catch {
      toast.error('Erro ao enviar resposta.');
    } finally {
      setSendingReply(false);
    }
  };

  const handleDeleteMedia = async () => {
    if (!selectedMedia) return;
    setDeletingMedia(true);
    try {
      await gestorPostsService.deleteMedia(selectedMedia.id, selectedChannel || undefined);
      toast.success('Post excluído com sucesso!');
      setConfirmDeleteMediaOpen(false);
      setSelectedMedia(null);
      loadGallery();
    } catch {
      toast.error('Não foi possível excluir o post. Contas conectadas via Login direto do Instagram não suportam exclusão pela API.');
    } finally {
      setDeletingMedia(false);
    }
  };

  if (loadingChannels) {
    return (
      <div className="flex flex-col min-h-full bg-background p-6 items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="flex flex-col min-h-full bg-background p-6 space-y-6">
        <BaseHeader title="Gestor de Posts" subtitle="Galeria de criativos e métricas do Instagram." />
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma conta Instagram conectada ainda. Conecte uma página do Facebook com Instagram vinculado (ou uma
            conta Instagram direta) em Configurações &gt; Integrações.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-background p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 relative">
        <BaseHeader title="Gestor de Posts" subtitle="Galeria de criativos, métricas e comentários do Instagram." />
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" onClick={openScheduledModal}>
            <Calendar className="w-4 h-4 mr-1.5" /> Posts Agendados
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setShowDateFilterModal(true);
              loadScheduledPosts();
            }}
            title="Filtrar por data"
          >
            <CalendarDays className="w-4 h-4" />
          </Button>
          <div className="relative">
            <Button variant="outline" size="icon" onClick={() => setShowSettingsMenu((v) => !v)} title="Opções">
              <SettingsIcon className="w-4 h-4" />
            </Button>
            {showSettingsMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSettingsMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-2xl p-4 space-y-4 z-50 max-h-[75vh] overflow-y-auto text-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-800">Opções</h3>
                    <button
                      onClick={() => toggleAllSettings([...VISUALIZATION_KEYS, ...METRIC_KEYS])}
                      className="text-xs text-blue-600 hover:underline font-semibold"
                    >
                      Ativar Tudo
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-gray-200 pb-1">
                      <p className="font-semibold text-gray-600 text-xs">Visualização</p>
                      <button
                        onClick={() => toggleAllSettings(VISUALIZATION_KEYS)}
                        className="text-xs text-blue-600 hover:underline font-semibold"
                      >
                        Ativar Todos
                      </button>
                    </div>
                    {(
                      [
                        { key: 'isAudioEnabled' as const, label: 'Áudio nos vídeos' },
                        { key: 'isInfoVisible' as const, label: 'Exibir legendas' },
                        { key: 'isDateVisible' as const, label: 'Exibir data' },
                      ]
                    ).map(({ key, label }) => (
                      <label key={key} className="flex items-center justify-between cursor-pointer select-none">
                        {label}
                        <input
                          type="checkbox"
                          checked={gallerySettings[key]}
                          onChange={(e) => updateGallerySetting(key, e.target.checked)}
                        />
                      </label>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-gray-200 pb-1">
                      <p className="font-semibold text-gray-600 text-xs">Exibir Métricas</p>
                      <button
                        onClick={() => toggleAllSettings(METRIC_KEYS)}
                        className="text-xs text-blue-600 hover:underline font-semibold"
                      >
                        Ativar Todos
                      </button>
                    </div>
                    {(
                      [
                        { key: 'isLikesVisible' as const, label: 'Curtidas' },
                        { key: 'isCommentsVisible' as const, label: 'Comentários' },
                        { key: 'isReachVisible' as const, label: 'Alcance' },
                        { key: 'isSavedVisible' as const, label: 'Salvos' },
                        { key: 'isInteractionsVisible' as const, label: 'Interações' },
                        { key: 'isSharesVisible' as const, label: 'Compart.' },
                        { key: 'isVisitsVisible' as const, label: 'Visitas Perfil' },
                        { key: 'isFollowsVisible' as const, label: 'Seguidores' },
                        { key: 'isWatchTimeVisible' as const, label: 'Tempo Médio' },
                      ]
                    ).map(({ key, label }) => (
                      <label key={key} className="flex items-center justify-between cursor-pointer select-none">
                        {label}
                        <input
                          type="checkbox"
                          checked={gallerySettings[key]}
                          onChange={(e) => updateGallerySetting(key, e.target.checked)}
                        />
                      </label>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <p className="font-semibold text-gray-600 text-xs border-b border-gray-200 pb-1">
                      Filtros e Ordenação
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Ordenar por</span>
                      <select
                        className="border border-gray-300 rounded-md text-xs p-1"
                        value={gallerySettings.sortOrder}
                        onChange={(e) => updateGallerySetting('sortOrder', e.target.value)}
                      >
                        {SORT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Filtrar por mídia</span>
                      <select
                        className="border border-gray-300 rounded-md text-xs p-1"
                        value={gallerySettings.mediaTypeFilter}
                        onChange={(e) =>
                          updateGallerySetting(
                            'mediaTypeFilter',
                            e.target.value as GallerySettings['mediaTypeFilter'],
                          )
                        }
                      >
                        <option value="all">Todos</option>
                        <option value="IMAGE">Imagem</option>
                        <option value="VIDEO">Vídeo</option>
                        <option value="CAROUSEL_ALBUM">Carrossel</option>
                      </select>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          <Button onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-1.5" /> Criar Post
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        {(
          [
            { id: 'instagram' as const, label: 'Instagram', icon: Instagram },
            { id: 'facebook' as const, label: 'Facebook', icon: Facebook },
            { id: 'youtube' as const, label: 'YouTube', icon: Youtube },
          ]
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setGalleryPlatform(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              galleryPlatform === id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {galleryPlatform === 'instagram' && (
        <>
          {channels.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {channels.map((c) => (
                <button
                  key={`${c.channel_type}-${c.channel_id}`}
                  onClick={() => setSelectedChannel(c)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedChannel?.channel_id === c.channel_id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/70'
                  }`}
                >
                  @{c.username}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            {(
              [
                { id: 'posts' as const, label: 'Posts' },
                { id: 'stories' as const, label: 'Stories (24h)' },
              ]
            ).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setInstagramView(id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  instagramView === id
                    ? 'bg-slate-700 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {instagramView === 'posts' && (
          <>
          {loadingGallery ? (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-16">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando galeria...
        </div>
      ) : (
        <>
          {accountInfo && (
            <Card>
              <CardContent className="py-4 flex flex-wrap items-center gap-6">
                {accountInfo.profile_picture_url && (
                  <img src={accountInfo.profile_picture_url} alt="" className="w-14 h-14 rounded-full object-cover" />
                )}
                <div>
                  <p className="font-semibold text-foreground">@{accountInfo.username}</p>
                  {accountInfo.biography && <p className="text-xs text-muted-foreground max-w-md">{accountInfo.biography}</p>}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground ml-auto">
                  <span className="flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5" /> {formatNumber(accountInfo.media_count)} posts
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> {formatNumber(accountInfo.followers_count)} seguidores
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> {formatNumber(accountInfo.follows_count)} seguindo
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {filteredSortedMedia.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhum post encontrado.</CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filteredSortedMedia.map((item) => {
                const MediaTypeIcon =
                  item.media_type === 'VIDEO' ? Play : item.media_type === 'CAROUSEL_ALBUM' ? Layers : ImageIcon;
                return (
                  <button
                    key={item.id}
                    onClick={() => openMedia(item)}
                    onMouseEnter={(e) => {
                      const video = e.currentTarget.querySelector('video');
                      if (video) {
                        video.muted = !gallerySettings.isAudioEnabled;
                        video.play().catch(() => {});
                      }
                    }}
                    onMouseLeave={(e) => {
                      const video = e.currentTarget.querySelector('video');
                      if (video) {
                        video.pause();
                        video.currentTime = 0;
                      }
                    }}
                    className="group relative aspect-square rounded-lg overflow-hidden bg-muted border border-border"
                  >
                    {item.media_type === 'VIDEO' ? (
                      <video
                        src={item.media_url}
                        poster={item.thumbnail_url}
                        loop
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img
                        src={item.thumbnail_url || item.media_url}
                        alt={item.caption || ''}
                        className="w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                      <MediaTypeIcon className="w-7 h-7 text-white" />
                      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-2">
                        {gallerySettings.isLikesVisible && (
                          <span className="text-white text-xs flex items-center gap-1">
                            <Heart className="w-3.5 h-3.5" /> {formatNumber(item.like_count)}
                          </span>
                        )}
                        {gallerySettings.isCommentsVisible && (
                          <span className="text-white text-xs flex items-center gap-1">
                            <MessageCircle className="w-3.5 h-3.5" /> {formatNumber(item.comments_count)}
                          </span>
                        )}
                        {gallerySettings.isReachVisible && (
                          <span className="text-white text-xs flex items-center gap-1">
                            <Target className="w-3.5 h-3.5" /> {formatNumber(insightValue(item, 'reach') || 0)}
                          </span>
                        )}
                        {gallerySettings.isSavedVisible && (
                          <span className="text-white text-xs flex items-center gap-1">
                            <Bookmark className="w-3.5 h-3.5" /> {formatNumber(insightValue(item, 'saved') || 0)}
                          </span>
                        )}
                        {gallerySettings.isInteractionsVisible && (
                          <span className="text-white text-xs flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" /> {formatNumber(insightValue(item, 'total_interactions') || 0)}
                          </span>
                        )}
                        {gallerySettings.isSharesVisible && (
                          <span className="text-white text-xs flex items-center gap-1">
                            <Share2 className="w-3.5 h-3.5" /> {formatNumber(insightValue(item, 'shares') || 0)}
                          </span>
                        )}
                        {gallerySettings.isVisitsVisible && (
                          <span className="text-white text-xs flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5" /> {formatNumber(insightValue(item, 'profile_visits') || 0)}
                          </span>
                        )}
                        {gallerySettings.isFollowsVisible && (
                          <span className="text-white text-xs flex items-center gap-1">
                            <UserPlus className="w-3.5 h-3.5" /> {formatNumber(insightValue(item, 'follows') || 0)}
                          </span>
                        )}
                        {gallerySettings.isWatchTimeVisible && item.media_type === 'VIDEO' && (
                          <span className="text-white text-xs flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> {formatNumber(insightValue(item, 'ig_reels_avg_watch_time') || 0)}s
                          </span>
                        )}
                      </div>
                    </div>
                    {(gallerySettings.isInfoVisible || gallerySettings.isDateVisible) && (
                      <div className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[11px] p-1.5 space-y-0.5">
                        {gallerySettings.isDateVisible && item.timestamp && (
                          <p className="opacity-80">{new Date(item.timestamp).toLocaleDateString('pt-BR')}</p>
                        )}
                        {gallerySettings.isInfoVisible && item.caption && (
                          <p className="line-clamp-2 text-left">{item.caption}</p>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </>
          )}
          </>
          )}

          {instagramView === 'stories' && (
            <>
              {loadingStories ? (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-16">
                  <Loader2 className="w-4 h-4 animate-spin" /> Carregando Stories...
                </div>
              ) : stories.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum Story ativo no momento (somem da API 24h depois de postados, mesmo salvos como destaque).
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {stories.map((story) => (
                    <a
                      key={story.id}
                      href={story.permalink}
                      target="_blank"
                      rel="noreferrer"
                      className="group relative aspect-[9/16] rounded-lg overflow-hidden bg-muted border border-border block"
                    >
                      {story.media_type === 'VIDEO' ? (
                        <video src={story.media_url} className="w-full h-full object-cover" muted />
                      ) : (
                        <img
                          src={story.thumbnail_url || story.media_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      )}
                    </a>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {galleryPlatform === 'facebook' && (
        <>
          {facebookChannels.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {facebookChannels.map((c) => (
                <button
                  key={c.channel_id}
                  onClick={() => setSelectedFacebookChannel(c)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedFacebookChannel?.channel_id === c.channel_id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/70'
                  }`}
                >
                  @{c.username}
                </button>
              ))}
            </div>
          )}

          {facebookChannels.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma página do Facebook conectada.
              </CardContent>
            </Card>
          ) : loadingFacebookGallery ? (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-16">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando galeria...
            </div>
          ) : (
            <>
              {facebookAccountInfo && (
                <Card>
                  <CardContent className="py-4 flex flex-wrap items-center gap-6">
                    {facebookAccountInfo.picture?.data?.url && (
                      <img src={facebookAccountInfo.picture.data.url} alt="" className="w-14 h-14 rounded-full object-cover" />
                    )}
                    <div>
                      <p className="font-semibold text-foreground">{facebookAccountInfo.name}</p>
                      {facebookAccountInfo.about && (
                        <p className="text-xs text-muted-foreground max-w-md">{facebookAccountInfo.about}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground ml-auto">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> {formatNumber(facebookAccountInfo.fan_count)} seguidores
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {facebookMedia.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhum post encontrado.</CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {facebookMedia.map((post) => {
                    const thumb = post.full_picture || post.attachments?.data?.[0]?.media?.image?.src;
                    return (
                      <button
                        key={post.id}
                        type="button"
                        onClick={() => setSelectedFacebookPost(post)}
                        className="group relative aspect-square rounded-lg overflow-hidden bg-muted border border-border block"
                      >
                        {thumb ? (
                          <img src={thumb} alt={post.message || ''} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center p-3 text-xs text-muted-foreground text-center">
                            {post.message?.slice(0, 120) || 'Post sem imagem'}
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                          <span className="text-white text-xs flex items-center gap-1">
                            <Heart className="w-3.5 h-3.5" /> {formatNumber(post.likes?.summary?.total_count)}
                          </span>
                          <span className="text-white text-xs flex items-center gap-1">
                            <MessageCircle className="w-3.5 h-3.5" /> {formatNumber(post.comments?.summary?.total_count)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}

      {galleryPlatform === 'youtube' && (
        <>
          {loadingYoutubeGallery ? (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-16">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando galeria...
            </div>
          ) : youtubeGalleryError ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">{youtubeGalleryError}</CardContent>
            </Card>
          ) : (
            <>
              {youtubeAccountInfo && (
                <Card>
                  <CardContent className="py-4 flex flex-wrap items-center gap-6">
                    {youtubeAccountInfo.snippet?.thumbnails?.default?.url && (
                      <img
                        src={youtubeAccountInfo.snippet.thumbnails.default.url}
                        alt=""
                        className="w-14 h-14 rounded-full object-cover"
                      />
                    )}
                    <div>
                      <p className="font-semibold text-foreground">{youtubeAccountInfo.snippet?.title}</p>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground ml-auto">
                      <span className="flex items-center gap-1">
                        <ImageIcon className="w-3.5 h-3.5" /> {formatNumber(Number(youtubeAccountInfo.statistics?.videoCount))} vídeos
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> {formatNumber(Number(youtubeAccountInfo.statistics?.subscriberCount))} inscritos
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {youtubeVideos.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhum vídeo encontrado.</CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {youtubeVideos.map((video, index) => {
                    const videoId = video.contentDetails?.videoId;
                    const thumb =
                      video.snippet?.thumbnails?.high?.url ||
                      video.snippet?.thumbnails?.medium?.url ||
                      video.snippet?.thumbnails?.default?.url;
                    return (
                      <a
                        key={videoId || index}
                        href={videoId ? `https://www.youtube.com/watch?v=${videoId}` : undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative aspect-square rounded-lg overflow-hidden bg-muted border border-border block"
                      >
                        {thumb && <img src={thumb} alt={video.snippet?.title || ''} className="w-full h-full object-cover" />}
                        <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-xs p-1.5 line-clamp-2">
                          {video.snippet?.title}
                        </div>
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                          <span className="text-white text-xs flex items-center gap-1">
                            <ImageIcon className="w-3.5 h-3.5" /> {formatNumber(Number(video.statistics?.viewCount))}
                          </span>
                        </div>
                      </a>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* --- MODAL: DETALHE DO POST + COMENTÁRIOS --- */}
      {selectedMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedMedia(null)} />
          <div className="relative w-full max-w-2xl bg-white rounded-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
              <h2 className="text-sm font-semibold text-gray-800">{selectedMedia.media_type}</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setConfirmDeleteMediaOpen(true)}
                  className="text-gray-400 hover:text-red-600"
                  title="Excluir post"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button onClick={() => setSelectedMedia(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto p-5 space-y-4">
              <img
                src={selectedMedia.media_url || selectedMedia.thumbnail_url}
                alt=""
                className="w-full max-h-72 object-contain rounded-lg bg-black/5"
              />
              {selectedMedia.caption && <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedMedia.caption}</p>}

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  <Heart className="w-3 h-3 mr-1" /> {formatNumber(selectedMedia.like_count)}
                </Badge>
                <Badge variant="outline">
                  <MessageCircle className="w-3 h-3 mr-1" /> {formatNumber(selectedMedia.comments_count)}
                </Badge>
                {insightValue(selectedMedia, 'reach') != null && (
                  <Badge variant="outline">Alcance: {formatNumber(insightValue(selectedMedia, 'reach')!)}</Badge>
                )}
                {insightValue(selectedMedia, 'views') != null && (
                  <Badge variant="outline">Visualizações: {formatNumber(insightValue(selectedMedia, 'views')!)}</Badge>
                )}
                {insightValue(selectedMedia, 'saved') != null && (
                  <Badge variant="outline">Salvos: {formatNumber(insightValue(selectedMedia, 'saved')!)}</Badge>
                )}
              </div>

              {selectedMedia.permalink && (
                <a
                  href={selectedMedia.permalink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Ver no Instagram
                </a>
              )}

              <div className="border-t border-gray-100 pt-3 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Comentários</p>
                {loadingComments ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                    <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                  </div>
                ) : comments.length === 0 ? (
                  <p className="text-sm text-gray-400">Nenhum comentário ainda.</p>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} className="text-sm border border-gray-100 rounded-lg p-3 space-y-2">
                      <p>
                        <span className="font-semibold text-gray-800">{c.username || c.from?.username}</span>{' '}
                        <span className="text-gray-600">{c.text}</span>
                      </p>
                      {replyingTo === c.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            className="flex-1 border-gray-300 rounded-md text-sm p-1.5 border"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Escreva uma resposta..."
                            autoFocus
                          />
                          <Button size="sm" disabled={sendingReply} onClick={() => handleReply(c.id)}>
                            {sendingReply ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setReplyingTo(null)}>
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setReplyingTo(c.id);
                            setReplyText('');
                          }}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Responder
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: DETALHE DO POST (FACEBOOK) --- */}
      {selectedFacebookPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedFacebookPost(null)} />
          <div className="relative w-full max-w-2xl bg-white rounded-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
              <h2 className="text-sm font-semibold text-gray-800">Post do Facebook</h2>
              <button onClick={() => setSelectedFacebookPost(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-5 space-y-4">
              {(selectedFacebookPost.full_picture || selectedFacebookPost.attachments?.data?.[0]?.media?.image?.src) && (
                <img
                  src={selectedFacebookPost.full_picture || selectedFacebookPost.attachments?.data?.[0]?.media?.image?.src}
                  alt=""
                  className="w-full max-h-72 object-contain rounded-lg bg-black/5"
                />
              )}
              {selectedFacebookPost.message && (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedFacebookPost.message}</p>
              )}

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  <Heart className="w-3 h-3 mr-1" /> {formatNumber(selectedFacebookPost.likes?.summary?.total_count)}
                </Badge>
                <Badge variant="outline">
                  <MessageCircle className="w-3 h-3 mr-1" /> {formatNumber(selectedFacebookPost.comments?.summary?.total_count)}
                </Badge>
                {selectedFacebookPost.created_time && (
                  <Badge variant="outline">{new Date(selectedFacebookPost.created_time).toLocaleString('pt-BR')}</Badge>
                )}
              </div>

              {selectedFacebookPost.permalink_url && (
                <a
                  href={selectedFacebookPost.permalink_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Ver no Facebook
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: CONFIRMAR EXCLUSÃO DO POST --- */}
      {confirmDeleteMediaOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !deletingMedia && setConfirmDeleteMediaOpen(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-lg shadow-2xl p-6 text-center">
            <h2 className="text-lg font-bold text-gray-800 mb-2">Confirmar Exclusão</h2>
            <p className="text-sm text-gray-500 mb-6">
              Tem certeza de que deseja excluir este post? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-center gap-3">
              <Button variant="outline" disabled={deletingMedia} onClick={() => setConfirmDeleteMediaOpen(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" disabled={deletingMedia} onClick={handleDeleteMedia}>
                {deletingMedia ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                Excluir
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: FILTRAR POR DATA --- */}
      {showDateFilterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDateFilterModal(false)} />
          <div className="relative w-full max-w-2xl bg-white rounded-lg shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">Filtrar por Data</h2>
              <button onClick={() => setShowDateFilterModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-6">
              {/* Coluna de Mês — igual ao modelo original: lista vertical à esquerda */}
              <div className="w-full sm:w-1/4 flex-shrink-0 space-y-1">
                <button
                  onClick={() => applyMonthFilter(null)}
                  className={`gestor-posts-month-btn ${activeMonthFilter === null ? 'active' : ''}`}
                >
                  Todos
                </button>
                {MONTH_LABELS.map((label, index) => (
                  <button
                    key={label}
                    onClick={() => applyMonthFilter(index)}
                    className={`gestor-posts-month-btn ${activeMonthFilter === index ? 'active' : ''}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Coluna do Calendário — igual ao modelo original: calendário
                  flatpickr à direita, seguido do período rápido e intervalo. */}
              <div className="w-full sm:w-3/4 space-y-4">
                {calendarEnabledDates.length > 0 ? (
                  <>
                    <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: '#38bdf8' }} />
                        Publicado
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: '#fbbf24' }} />
                        Agendado
                      </span>
                    </div>
                    <div ref={calendarContainerRef} className="gestor-posts-datepicker" />
                  </>
                ) : (
                  <p className="text-xs text-gray-400 text-center py-4">Nenhuma data de postagem disponível.</p>
                )}

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Período Rápido</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'today' as const, label: 'Hoje' },
                        { id: 'yesterday' as const, label: 'Ontem' },
                        { id: 'week' as const, label: 'Semana' },
                        { id: 'month' as const, label: 'Mês' },
                        { id: 'year' as const, label: 'Ano' },
                        { id: 'all' as const, label: 'Todos' },
                      ]
                    ).map(({ id, label }) => (
                      <button key={id} onClick={() => applyQuickDateRange(id)} className="gestor-posts-date-filter-btn">
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Intervalo Específico</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      className="flex-1 border border-gray-300 rounded-md text-sm p-2"
                      value={dateRangeStart}
                      onChange={(e) => {
                        setActiveMonthFilter(null);
                        setDateRangeStart(e.target.value);
                      }}
                    />
                    <span className="text-gray-400">-</span>
                    <input
                      type="date"
                      className="flex-1 border border-gray-300 rounded-md text-sm p-2"
                      value={dateRangeEnd}
                      onChange={(e) => {
                        setActiveMonthFilter(null);
                        setDateRangeEnd(e.target.value);
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <style>{`
            /* Cores exatas do modelo original (galeria de criativos). */
            .gestor-posts-month-btn {
              background-color: #334155;
              color: #cbd5e1;
              width: 100%;
              text-align: center;
              padding: 5px 4px;
              border-radius: 4px;
              font-size: 0.75rem;
              font-weight: 500;
              transition: all 0.2s ease-in-out;
            }
            .gestor-posts-month-btn:hover { background-color: #475569; color: #e2e8f0; }
            .gestor-posts-month-btn.active { background-color: #38bdf8; color: #0f172a; font-weight: bold; }

            .gestor-posts-date-filter-btn {
              background-color: #334155;
              color: #cbd5e1;
              padding: 0.4rem 0.25rem;
              border-radius: 0.375rem;
              font-size: 0.75rem;
              font-weight: 500;
              transition: background-color 0.2s;
            }
            .gestor-posts-date-filter-btn:hover { background-color: #475569; }

            .gestor-posts-datepicker { width: 100%; }
            .gestor-posts-datepicker .flatpickr-calendar {
              background: #1e293b;
              border: 1px solid #334155;
              width: 100% !important;
              max-width: none !important;
              box-shadow: none;
            }
            .gestor-posts-datepicker .flatpickr-months .flatpickr-month,
            .gestor-posts-datepicker .flatpickr-weekday,
            .gestor-posts-datepicker .flatpickr-weekdays { color: #cbd5e1; background: transparent; fill: #cbd5e1; }
            .gestor-posts-datepicker .flatpickr-months .flatpickr-prev-month,
            .gestor-posts-datepicker .flatpickr-months .flatpickr-next-month { fill: #cbd5e1; }
            .gestor-posts-datepicker .flatpickr-day { color: #cbd5e1; }
            .gestor-posts-datepicker .flatpickr-day:hover { background: #334155; }
            .gestor-posts-datepicker .flatpickr-day.selected,
            .gestor-posts-datepicker .flatpickr-day.today:not(.selected) {
              background: #38bdf8; border-color: #38bdf8; color: #0f172a;
            }
            .gestor-posts-datepicker .flatpickr-day.flatpickr-disabled,
            .gestor-posts-datepicker .flatpickr-day.flatpickr-disabled:hover { color: #475569; background: transparent; }
            .gestor-posts-datepicker .flatpickr-day.has-posts {
              background: rgba(56, 189, 248, 0.15);
              border: 1px solid rgba(56, 189, 248, 0.6);
              color: #e0f2fe;
              font-weight: bold;
            }
            .gestor-posts-datepicker .flatpickr-day.has-posts:hover { background: rgba(56, 189, 248, 0.35); }
            .gestor-posts-datepicker .flatpickr-day.has-scheduled {
              background: rgba(251, 191, 36, 0.15);
              border: 1px solid rgba(251, 191, 36, 0.7);
              color: #fef3c7;
              font-weight: bold;
            }
            .gestor-posts-datepicker .flatpickr-day.has-scheduled:hover { background: rgba(251, 191, 36, 0.35); }
            .gestor-posts-datepicker .flatpickr-day.has-posts.has-scheduled {
              background: linear-gradient(135deg, rgba(56, 189, 248, 0.3) 50%, rgba(251, 191, 36, 0.3) 50%);
              border: 1px solid #e2e8f0;
              color: #f8fafc;
            }
            .gestor-posts-datepicker .flatpickr-day.has-posts.has-scheduled:hover {
              background: linear-gradient(135deg, rgba(56, 189, 248, 0.5) 50%, rgba(251, 191, 36, 0.5) 50%);
            }
            .gestor-posts-datepicker .numInputWrapper span:hover { background: #334155; }
          `}</style>
        </div>
      )}

      {/* --- MODAL: CRIAR POST --- */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (!creating) setShowCreateModal(false);
            }}
          />
          <div className="relative w-full max-w-lg bg-white rounded-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
              <h2 className="text-sm font-semibold text-gray-800">Criar Post</h2>
              <button
                onClick={() => {
                  if (!creating) setShowCreateModal(false);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-4">
              {mediaType === 'text' ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg py-6 flex items-center justify-center text-xs text-gray-400">
                  Status de texto — sem mídia, só a legenda abaixo.
                </div>
              ) : mediaType === 'audio' ? (
                <div>
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => {
                      handleAudioFileSelect(e.target.files?.[0] || null);
                      if (audioInputRef.current) audioInputRef.current.value = '';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => audioInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 border border-gray-300 rounded-md py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <Upload className="w-4 h-4" /> Selecionar Áudio
                  </button>
                  {uploadedFiles[0] && (
                    <p className="text-xs text-gray-500 text-center mt-1">{uploadedFiles[0].name}</p>
                  )}
                </div>
              ) : (
                <>
                  {/* Upload: pasta ou arquivos — igual ao modelo original, os dois
                      aceitam múltiplos arquivos de uma vez. */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => folderInputRef.current?.click()}
                      className="flex-1 flex items-center justify-center gap-2 border border-gray-300 rounded-md py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      <FolderOpen className="w-4 h-4" /> Subir Pasta
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 flex items-center justify-center gap-2 border border-gray-300 rounded-md py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      <Upload className="w-4 h-4" /> Subir Arquivos
                    </button>
                  </div>
                  <input
                    ref={folderInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    {...({ webkitdirectory: 'true' } as React.InputHTMLAttributes<HTMLInputElement>)}
                    onChange={(e) => {
                      handleFolderInputChange(e.target.files);
                      if (folderInputRef.current) folderInputRef.current.value = '';
                    }}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={(e) => {
                      addUploadedFiles(e.target.files);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  />

                  {/* Opções de pasta: igual ao modelo original — filtro por data,
                      cliente e post, preenchidos a partir da estrutura de pastas
                      Cliente/AAAA-MM-DD/NomeDoPost/FORMATO. */}
                  {showFolderOptions && (
                    <div className="space-y-3 border border-gray-200 rounded-lg p-3 bg-gray-50">
                      <label className="flex items-center justify-between gap-2 text-sm text-gray-700 cursor-pointer select-none">
                        Carregar apenas posts de hoje em diante
                        <input
                          type="checkbox"
                          checked={folderFilterToday}
                          onChange={(e) => setFolderFilterToday(e.target.checked)}
                        />
                      </label>
                      {clientNames.length > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Selecionar Cliente</label>
                            <select
                              className="w-full border border-gray-300 rounded-md text-sm p-2"
                              value={selectedClient}
                              onChange={(e) => handleClientChange(e.target.value)}
                            >
                              {clientNames.map((name) => (
                                <option key={name} value={name}>
                                  {name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Personalizar Post</label>
                            <select
                              className="w-full border border-gray-300 rounded-md text-sm p-2"
                              value={selectedPost}
                              onChange={(e) => handlePostChange(e.target.value)}
                            >
                              {postNames.map((name) => (
                                <option key={name} value={name}>
                                  {name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Prévia — lista única de arquivos, reordenável e removível
                      individualmente, igual ao modelo original. Em modo
                      Imagem/Vídeo só o primeiro arquivo é publicado; em modo
                      Carrossel, todos (até 10). */}
                  {uploadedFiles.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2">
                      {uploadedPreviewUrls.map((url, index) => {
                        const file = uploadedFiles[index];
                        const isVideo = file?.type.startsWith('video/');
                        return (
                          <div key={url} className="relative aspect-square group">
                            {isVideo ? (
                              <video src={url} muted className="w-full h-full object-cover rounded-lg bg-black/5" />
                            ) : (
                              <img src={url} alt="" className="w-full h-full object-cover rounded-lg bg-black/5" />
                            )}
                            <button
                              onClick={() => removeUploadedFileAt(index)}
                              className="absolute top-1 right-1 bg-white/90 rounded-full p-0.5 shadow opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                            {uploadedFiles.length > 1 && (
                              <div className="absolute bottom-1 inset-x-1 flex justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  disabled={index === 0}
                                  onClick={() => moveUploadedFile(index, -1)}
                                  className="w-5 h-5 bg-slate-700/80 rounded-full text-white flex items-center justify-center text-xs disabled:opacity-40"
                                >
                                  ←
                                </button>
                                <button
                                  disabled={index === uploadedFiles.length - 1}
                                  onClick={() => moveUploadedFile(index, 1)}
                                  className="w-5 h-5 bg-slate-700/80 rounded-full text-white flex items-center justify-center text-xs disabled:opacity-40"
                                >
                                  →
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg py-6 flex items-center justify-center text-xs text-gray-400">
                      Nenhuma mídia selecionada ainda.
                    </div>
                  )}
                </>
              )}

              {/* Plataforma(s) */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Plataforma(s)</p>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      { id: 'instagram' as const, label: 'Instagram', icon: Instagram },
                      { id: 'facebook' as const, label: 'Facebook', icon: Facebook },
                      { id: 'whatsapp' as const, label: 'WhatsApp', icon: Phone },
                      { id: 'youtube' as const, label: 'YouTube', icon: Youtube },
                    ]
                  ).map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => togglePlatformEnabled(id)}
                      disabled={id === 'whatsapp' ? mediaType === 'carousel' : id === 'youtube' ? mediaType === 'carousel' || !youtubeConnected : false}
                      className={`flex flex-col items-center gap-1 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none ${
                        platformEnabled[id]
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/70'
                      }`}
                    >
                      <Icon className="w-4 h-4" /> {label}
                    </button>
                  ))}
                </div>
              </div>

              {platformEnabled.instagram && (
                <DestinationChecklist
                  title="Contas do Instagram"
                  icon={<Instagram className="w-3.5 h-3.5" />}
                  items={channels.map((c) => ({ id: c.channel_id, label: `@${c.username}` }))}
                  selected={destInstagramIds}
                  onToggle={(id) => setDestInstagramIds((prev) => toggleInDest(prev, id))}
                  emptyLabel="Nenhuma conta do Instagram conectada."
                />
              )}

              {platformEnabled.facebook && (
                <DestinationChecklist
                  title="Páginas do Facebook"
                  icon={<Facebook className="w-3.5 h-3.5" />}
                  items={facebookChannels.map((c) => ({ id: c.channel_id, label: `@${c.username}` }))}
                  selected={destFacebookIds}
                  onToggle={(id) => setDestFacebookIds((prev) => toggleInDest(prev, id))}
                  emptyLabel="Nenhuma página do Facebook conectada."
                />
              )}

              {platformEnabled.whatsapp && (
                <DestinationChecklist
                  title="Instâncias do WhatsApp"
                  icon={<Phone className="w-3.5 h-3.5" />}
                  items={whatsappChannels.map((c) => ({ id: c.channel_id, label: c.name }))}
                  selected={destWhatsappIds}
                  onToggle={(id) => setDestWhatsappIds((prev) => toggleInDest(prev, id))}
                  emptyLabel="Nenhuma instância de WhatsApp com suporte a Status."
                />
              )}

              {platformEnabled.youtube && (
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <Checkbox checked={destYoutube} onCheckedChange={() => setDestYoutube((v) => !v)} />
                  <Youtube className="w-3.5 h-3.5" /> Canal do YouTube conectado
                </label>
              )}

              {/* Formato(s) — só relevante pra Instagram/Facebook */}
              {(platformEnabled.instagram || platformEnabled.facebook) && mediaType !== 'carousel' && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Formato(s)</p>
                  <div className="grid grid-cols-3 gap-2">
                    {FORMAT_ORDER.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => toggleFormat(type)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          newFormats[type]
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/70'
                        }`}
                      >
                        {CONTENT_TYPE_LABELS[type]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tipo de Mídia */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Tipo de Mídia</p>
                <div className={`grid gap-2 ${whatsappOnlySelected ? 'grid-cols-5' : 'grid-cols-3'}`}>
                  {(
                    [
                      { id: 'image' as const, label: 'Imagem' },
                      { id: 'video' as const, label: 'Vídeo' },
                      { id: 'carousel' as const, label: 'Carrossel' },
                      ...(whatsappOnlySelected
                        ? [
                            { id: 'text' as const, label: 'Texto' },
                            { id: 'audio' as const, label: 'Áudio' },
                          ]
                        : []),
                    ]
                  ).map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => selectMediaType(id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        mediaType === id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/70'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {mediaType === 'video' && (
                <div>
                  <input
                    ref={thumbInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setThumbFile(e.target.files?.[0] || null)}
                  />
                  <button
                    type="button"
                    onClick={() => thumbInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 border border-gray-300 rounded-md py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <ImageIcon className="w-4 h-4" /> Subir Thumbnail
                  </button>
                  {thumbFile && (
                    <p className="text-xs text-gray-500 text-center mt-1">{thumbFile.name}</p>
                  )}
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Legenda</p>
                <textarea
                  className="w-full border border-gray-300 rounded-md text-sm p-2.5"
                  rows={3}
                  value={newCaption}
                  onChange={(e) => setNewCaption(e.target.value)}
                  placeholder="Escreva a legenda do post..."
                />
              </div>

              <div>
                <label
                  className={`flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none mb-2 ${
                    destWhatsappIds.length > 0 || destYoutube ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={newIsScheduled}
                    disabled={destWhatsappIds.length > 0 || destYoutube}
                    onChange={(e) => {
                      setNewIsScheduled(e.target.checked);
                      if (e.target.checked && !newScheduledFor) setNewScheduledFor(toDatetimeLocalMin());
                    }}
                  />
                  Agendar Publicação (só Instagram/Facebook)
                </label>
                {newIsScheduled && (
                  <input
                    type="datetime-local"
                    className="w-full border border-gray-300 rounded-md text-sm p-2"
                    value={newScheduledFor}
                    min={toDatetimeLocalMin()}
                    onChange={(e) => setNewScheduledFor(e.target.value)}
                  />
                )}
              </div>

              {createProgress && <p className="text-xs text-muted-foreground">{createProgress}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <Button
                variant="outline"
                disabled={creating}
                onClick={() => {
                  setShowCreateModal(false);
                  resetCreateForm();
                }}
              >
                Cancelar
              </Button>
              <Button disabled={creating} onClick={handleCreatePost}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                {newIsScheduled ? 'Agendar' : 'Publicar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: POSTS AGENDADOS --- */}
      {showScheduledModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowScheduledModal(false)} />
          <div className="relative w-full max-w-2xl bg-white rounded-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
              <h2 className="text-sm font-semibold text-gray-800">Posts Agendados</h2>
              <button onClick={() => setShowScheduledModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-5 space-y-3">
              {loadingScheduled ? (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-8">
                  <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                </div>
              ) : scheduledPosts.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Nenhum post agendado ainda.</p>
              ) : (
                scheduledPosts.map((post) => (
                  <div key={post.id} className="border border-gray-100 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">{SCHEDULED_STATUS_LABELS[post.status]}</Badge>
                        <Badge variant="outline" className="capitalize">
                          {CONTENT_TYPE_LABELS[post.content_type]}
                        </Badge>
                        {post.platforms.map((p) => (
                          <Badge key={p} variant="outline" className="capitalize">
                            {p}
                          </Badge>
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {new Date(post.scheduled_for).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    {post.caption && <p className="text-sm text-gray-600 line-clamp-2">{post.caption}</p>}
                    {post.status === 'failed' && post.error_message && (
                      <p className="text-xs text-red-600">{post.error_message}</p>
                    )}
                    <div className="flex items-center gap-2">
                      {post.status === 'scheduled' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={scheduledActionId === post.id}
                          onClick={() => handleCancelScheduled(post.id)}
                        >
                          <X className="w-3.5 h-3.5 mr-1" /> Cancelar
                        </Button>
                      )}
                      {post.status === 'failed' && post.retry_count < post.max_retries && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={scheduledActionId === post.id}
                          onClick={() => handleRetryScheduled(post.id)}
                        >
                          <RotateCcw className="w-3.5 h-3.5 mr-1" /> Tentar novamente
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
