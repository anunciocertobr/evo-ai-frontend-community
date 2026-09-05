import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Heart, MessageCircle, Users, Image as ImageIcon, X, Send, Plus, Upload, FolderOpen, Calendar, RotateCcw, Phone, Youtube, Instagram, Facebook, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
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

const CONTENT_TYPE_LABELS: Record<PublicationContentType, string> = {
  feed: 'Feed',
  stories: 'Stories',
  reels: 'Reels',
};

// Ordem igual ao modelo original: Stories, Feed, Reels.
const FORMAT_ORDER: PublicationContentType[] = ['stories', 'feed', 'reels'];

const WHATSAPP_STATUS_TYPE_LABELS: Record<WhatsappStatusType, string> = {
  text: 'Texto',
  image: 'Imagem',
  video: 'Vídeo',
  audio: 'Áudio',
};

const YOUTUBE_PRIVACY_LABELS: Record<YoutubePrivacyStatus, string> = {
  public: 'Público',
  unlisted: 'Não listado',
  private: 'Privado',
};

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
  // "Tipo de Mídia" — Imagem/Vídeo/Carrossel, escolha única.
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'carousel' | ''>('');
  const [newIsCarousel, setNewIsCarousel] = useState(false);
  const [newIsScheduled, setNewIsScheduled] = useState(false);
  const [newScheduledFor, setNewScheduledFor] = useState('');
  const [creating, setCreating] = useState(false);
  const [createProgress, setCreateProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

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

  const [showWhatsappModal, setShowWhatsappModal] = useState(false);
  const [whatsappChannels, setWhatsappChannels] = useState<WhatsappStatusChannelOption[]>([]);
  const [loadingWhatsappChannels, setLoadingWhatsappChannels] = useState(false);
  const [whatsappChannelId, setWhatsappChannelId] = useState('');
  const [whatsappType, setWhatsappType] = useState<WhatsappStatusType>('text');
  const [whatsappText, setWhatsappText] = useState('');
  const [whatsappCaption, setWhatsappCaption] = useState('');
  const [whatsappFile, setWhatsappFile] = useState<File | null>(null);
  const [whatsappPreviewUrl, setWhatsappPreviewUrl] = useState<string | null>(null);
  const [sendingWhatsappStatus, setSendingWhatsappStatus] = useState(false);
  const whatsappFileInputRef = useRef<HTMLInputElement>(null);

  const [showYoutubeModal, setShowYoutubeModal] = useState(false);
  const [youtubeConnected, setYoutubeConnected] = useState<boolean | null>(null);
  const [loadingYoutubeConnected, setLoadingYoutubeConnected] = useState(false);
  const [youtubeTitle, setYoutubeTitle] = useState('');
  const [youtubeDescription, setYoutubeDescription] = useState('');
  const [youtubePrivacy, setYoutubePrivacy] = useState<YoutubePrivacyStatus>('unlisted');
  const [youtubeFile, setYoutubeFile] = useState<File | null>(null);
  const [youtubePreviewUrl, setYoutubePreviewUrl] = useState<string | null>(null);
  const [sendingYoutubeUpload, setSendingYoutubeUpload] = useState(false);
  const youtubeFileInputRef = useRef<HTMLInputElement>(null);

  const facebookChannels = channels.filter((c) => c.channel_type === ('Channel::FacebookPage' as SocialChannelType));

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

  const selectMediaType = (type: 'image' | 'video' | 'carousel') => {
    setMediaType(type);
    setNewIsCarousel(type === 'carousel');
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

  const handleWhatsappFileChange = (file: File | null) => {
    setWhatsappFile(file);
    if (whatsappPreviewUrl) URL.revokeObjectURL(whatsappPreviewUrl);
    setWhatsappPreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  const resetWhatsappForm = () => {
    setWhatsappChannelId('');
    setWhatsappType('text');
    setWhatsappText('');
    setWhatsappCaption('');
    handleWhatsappFileChange(null);
  };

  const openWhatsappModal = async () => {
    setShowWhatsappModal(true);
    setLoadingWhatsappChannels(true);
    try {
      const data = await gestorPostsService.getWhatsappStatusChannels();
      setWhatsappChannels(data);
      if (data.length > 0) setWhatsappChannelId(data[0].channel_id);
    } catch {
      toast.error('Erro ao carregar canais de WhatsApp.');
    } finally {
      setLoadingWhatsappChannels(false);
    }
  };

  const handleSendWhatsappStatus = async () => {
    if (!whatsappChannelId) {
      toast.error('Selecione um canal de WhatsApp.');
      return;
    }
    if (whatsappType === 'text' && !whatsappText.trim()) {
      toast.error('Escreva o texto do status.');
      return;
    }
    if (whatsappType !== 'text' && !whatsappFile) {
      toast.error('Selecione um arquivo de mídia.');
      return;
    }
    setSendingWhatsappStatus(true);
    try {
      await gestorPostsService.createWhatsappStatus({
        channel_id: whatsappChannelId,
        type: whatsappType,
        content: whatsappType === 'text' ? whatsappText.trim() : undefined,
        media: whatsappType !== 'text' ? whatsappFile || undefined : undefined,
        caption: whatsappCaption.trim() || undefined,
      });
      toast.success('Status publicado no WhatsApp!');
      setShowWhatsappModal(false);
      resetWhatsappForm();
    } catch {
      toast.error('Erro ao publicar o status no WhatsApp.');
    } finally {
      setSendingWhatsappStatus(false);
    }
  };

  const handleYoutubeFileChange = (file: File | null) => {
    setYoutubeFile(file);
    if (youtubePreviewUrl) URL.revokeObjectURL(youtubePreviewUrl);
    setYoutubePreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  const resetYoutubeForm = () => {
    setYoutubeTitle('');
    setYoutubeDescription('');
    setYoutubePrivacy('unlisted');
    handleYoutubeFileChange(null);
  };

  const openYoutubeModal = async () => {
    setShowYoutubeModal(true);
    setLoadingYoutubeConnected(true);
    try {
      const connected = await gestorPostsService.getYoutubeConnected();
      setYoutubeConnected(connected);
    } catch {
      setYoutubeConnected(false);
    } finally {
      setLoadingYoutubeConnected(false);
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

  const handleSendYoutubeUpload = async () => {
    if (!youtubeTitle.trim()) {
      toast.error('Escreva um título para o vídeo.');
      return;
    }
    if (!youtubeFile) {
      toast.error('Selecione um arquivo de vídeo.');
      return;
    }
    setSendingYoutubeUpload(true);
    try {
      const upload = await gestorPostsService.createYoutubeUpload({
        title: youtubeTitle.trim(),
        description: youtubeDescription.trim(),
        privacy_status: youtubePrivacy,
        video: youtubeFile,
      });
      toast.success('Vídeo enviado! Publicando no YouTube em segundo plano...');
      setShowYoutubeModal(false);
      resetYoutubeForm();
      pollYoutubeUploadStatus(upload.id);
    } catch {
      toast.error('Erro ao enviar o vídeo.');
    } finally {
      setSendingYoutubeUpload(false);
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
      channel_type: channel.channel_type,
      channel_id: channel.channel_id,
    });
    pollPublicationStatus(id);
  };

  const publishWhatsappJob = async (channelId: string) => {
    const file = uploadedFiles[0];
    if (!file) return;
    const type: WhatsappStatusType = file.type.startsWith('video/') ? 'video' : 'image';
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

    if (!hasMeta && !hasWhatsapp && !hasYoutube) {
      toast.error('Selecione ao menos uma plataforma e uma conta de destino.');
      return;
    }
    if (!mediaType) {
      toast.error('Selecione o Tipo de Mídia (Imagem, Vídeo ou Carrossel).');
      return;
    }
    if (hasMeta && !newIsCarousel && formats.length === 0) {
      toast.error('Selecione ao menos um formato (Feed, Stories ou Reels).');
      return;
    }
    if (newIsCarousel) {
      if (uploadedFiles.length < 2) {
        toast.error('Selecione ao menos 2 imagens para o carrossel.');
        return;
      }
      if (hasWhatsapp || hasYoutube) {
        toast.error('Carrossel só é suportado para Instagram/Facebook. Desmarque WhatsApp/YouTube ou desative o carrossel.');
        return;
      }
    } else if (uploadedFiles.length === 0) {
      toast.error('Selecione um arquivo de mídia.');
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
      <div className="flex items-center justify-between gap-4">
        <BaseHeader title="Gestor de Posts" subtitle="Galeria de criativos, métricas e comentários do Instagram." />
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" onClick={openYoutubeModal}>
            <Youtube className="w-4 h-4 mr-1.5" /> Vídeo (YouTube)
          </Button>
          <Button variant="outline" onClick={openWhatsappModal}>
            <Phone className="w-4 h-4 mr-1.5" /> Status do WhatsApp
          </Button>
          <Button variant="outline" onClick={openScheduledModal}>
            <Calendar className="w-4 h-4 mr-1.5" /> Posts Agendados
          </Button>
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

          {media.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhum post encontrado.</CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {media.map((item) => (
                <button
                  key={item.id}
                  onClick={() => openMedia(item)}
                  className="group relative aspect-square rounded-lg overflow-hidden bg-muted border border-border"
                >
                  <img
                    src={item.thumbnail_url || item.media_url}
                    alt={item.caption || ''}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                    <span className="text-white text-xs flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5" /> {formatNumber(item.like_count)}
                    </span>
                    <span className="text-white text-xs flex items-center gap-1">
                      <MessageCircle className="w-3.5 h-3.5" /> {formatNumber(item.comments_count)}
                    </span>
                  </div>
                </button>
              ))}
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
                      <a
                        key={post.id}
                        href={post.permalink_url}
                        target="_blank"
                        rel="noreferrer"
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
                      </a>
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
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'image' as const, label: 'Imagem' },
                      { id: 'video' as const, label: 'Vídeo' },
                      { id: 'carousel' as const, label: 'Carrossel' },
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

      {/* --- MODAL: STATUS DO WHATSAPP --- */}
      {showWhatsappModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (!sendingWhatsappStatus) setShowWhatsappModal(false);
            }}
          />
          <div className="relative w-full max-w-lg bg-white rounded-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
              <h2 className="text-sm font-semibold text-gray-800">Status do WhatsApp</h2>
              <button
                onClick={() => {
                  if (!sendingWhatsappStatus) setShowWhatsappModal(false);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingWhatsappChannels ? (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-8">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando canais...
              </div>
            ) : whatsappChannels.length === 0 ? (
              <div className="p-5 text-sm text-gray-400 text-center">
                Nenhum canal de WhatsApp com suporte a Status conectado.
              </div>
            ) : (
              <>
                <div className="overflow-y-auto p-5 space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Canal</p>
                    <select
                      className="w-full border border-gray-300 rounded-md text-sm p-2"
                      value={whatsappChannelId}
                      onChange={(e) => setWhatsappChannelId(e.target.value)}
                    >
                      {whatsappChannels.map((c) => (
                        <option key={c.channel_id} value={c.channel_id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Tipo</p>
                    <div className="flex gap-2">
                      {(Object.keys(WHATSAPP_STATUS_TYPE_LABELS) as WhatsappStatusType[]).map((type) => (
                        <button
                          key={type}
                          onClick={() => setWhatsappType(type)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            whatsappType === type
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-muted/70'
                          }`}
                        >
                          {WHATSAPP_STATUS_TYPE_LABELS[type]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {whatsappType === 'text' ? (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Texto</p>
                      <textarea
                        className="w-full border border-gray-300 rounded-md text-sm p-2.5"
                        rows={3}
                        value={whatsappText}
                        onChange={(e) => setWhatsappText(e.target.value)}
                        placeholder="Escreva o texto do status..."
                      />
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Mídia</p>
                      <input
                        ref={whatsappFileInputRef}
                        type="file"
                        accept={
                          whatsappType === 'image' ? 'image/*' : whatsappType === 'video' ? 'video/*' : 'audio/*'
                        }
                        className="hidden"
                        onChange={(e) => handleWhatsappFileChange(e.target.files?.[0] || null)}
                      />
                      {whatsappFile ? (
                        <div className="relative">
                          {whatsappType === 'image' && whatsappPreviewUrl && (
                            <img src={whatsappPreviewUrl} alt="" className="w-full max-h-64 rounded-lg bg-black/5 object-contain" />
                          )}
                          {whatsappType === 'video' && whatsappPreviewUrl && (
                            <video src={whatsappPreviewUrl} controls className="w-full max-h-64 rounded-lg bg-black/5" />
                          )}
                          {whatsappType === 'audio' && whatsappPreviewUrl && (
                            <audio src={whatsappPreviewUrl} controls className="w-full" />
                          )}
                          <button
                            onClick={() => handleWhatsappFileChange(null)}
                            className="absolute top-2 right-2 bg-white/90 rounded-full p-1 shadow"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => whatsappFileInputRef.current?.click()}
                          className="w-full border-2 border-dashed border-gray-300 rounded-lg py-8 flex flex-col items-center gap-2 text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors"
                        >
                          <Upload className="w-6 h-6" />
                          <span className="text-sm">Selecionar {WHATSAPP_STATUS_TYPE_LABELS[whatsappType].toLowerCase()}</span>
                        </button>
                      )}
                    </div>
                  )}

                  {whatsappType !== 'text' && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Legenda (opcional)</p>
                      <textarea
                        className="w-full border border-gray-300 rounded-md text-sm p-2.5"
                        rows={2}
                        value={whatsappCaption}
                        onChange={(e) => setWhatsappCaption(e.target.value)}
                        placeholder="Escreva uma legenda..."
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                  <Button
                    variant="outline"
                    disabled={sendingWhatsappStatus}
                    onClick={() => {
                      setShowWhatsappModal(false);
                      resetWhatsappForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button disabled={sendingWhatsappStatus} onClick={handleSendWhatsappStatus}>
                    {sendingWhatsappStatus ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                    Publicar
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* --- MODAL: VÍDEO PARA O YOUTUBE --- */}
      {showYoutubeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (!sendingYoutubeUpload) setShowYoutubeModal(false);
            }}
          />
          <div className="relative w-full max-w-lg bg-white rounded-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
              <h2 className="text-sm font-semibold text-gray-800">Enviar Vídeo para o YouTube</h2>
              <button
                onClick={() => {
                  if (!sendingYoutubeUpload) setShowYoutubeModal(false);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingYoutubeConnected ? (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-8">
                <Loader2 className="w-4 h-4 animate-spin" /> Verificando conexão...
              </div>
            ) : !youtubeConnected ? (
              <div className="p-5 text-sm text-gray-500 text-center space-y-2">
                <p>Nenhuma conta Google conectada com acesso ao YouTube.</p>
                <p>
                  Conecte em <span className="font-medium">Configurações &gt; Integrações &gt; Google</span>{' '}
                  (se já conectou antes, será preciso reconectar para autorizar o novo acesso).
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-y-auto p-5 space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Vídeo</p>
                    <input
                      ref={youtubeFileInputRef}
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(e) => handleYoutubeFileChange(e.target.files?.[0] || null)}
                    />
                    {youtubeFile && youtubePreviewUrl ? (
                      <div className="relative">
                        <video src={youtubePreviewUrl} controls className="w-full max-h-64 rounded-lg bg-black/5" />
                        <button
                          onClick={() => handleYoutubeFileChange(null)}
                          className="absolute top-2 right-2 bg-white/90 rounded-full p-1 shadow"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => youtubeFileInputRef.current?.click()}
                        className="w-full border-2 border-dashed border-gray-300 rounded-lg py-8 flex flex-col items-center gap-2 text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors"
                      >
                        <Upload className="w-6 h-6" />
                        <span className="text-sm">Selecionar vídeo</span>
                      </button>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Título</p>
                    <input
                      className="w-full border border-gray-300 rounded-md text-sm p-2.5"
                      value={youtubeTitle}
                      onChange={(e) => setYoutubeTitle(e.target.value)}
                      placeholder="Título do vídeo"
                    />
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Descrição</p>
                    <textarea
                      className="w-full border border-gray-300 rounded-md text-sm p-2.5"
                      rows={3}
                      value={youtubeDescription}
                      onChange={(e) => setYoutubeDescription(e.target.value)}
                      placeholder="Descrição do vídeo..."
                    />
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Privacidade</p>
                    <div className="flex gap-2">
                      {(Object.keys(YOUTUBE_PRIVACY_LABELS) as YoutubePrivacyStatus[]).map((status) => (
                        <button
                          key={status}
                          onClick={() => setYoutubePrivacy(status)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            youtubePrivacy === status
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-muted/70'
                          }`}
                        >
                          {YOUTUBE_PRIVACY_LABELS[status]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                  <Button
                    variant="outline"
                    disabled={sendingYoutubeUpload}
                    onClick={() => {
                      setShowYoutubeModal(false);
                      resetYoutubeForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button disabled={sendingYoutubeUpload} onClick={handleSendYoutubeUpload}>
                    {sendingYoutubeUpload ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                    Enviar
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
