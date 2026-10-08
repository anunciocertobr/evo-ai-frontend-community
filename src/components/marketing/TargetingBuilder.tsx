import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Button,
  Input,
  Label,
  Badge,
  Checkbox,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@evoapi/design-system';
import { Plus, X, Search, Users2, Sparkles, ListPlus, Trash2, ChevronLeft, Copy, Pencil, MapPin, XCircle } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { MetaScopedEntityPicker } from '@/components/marketing/MetaScopedEntityPicker';
import { useMetaAdAccountScope } from '@/components/marketing/metaAdAccountScope';
import { clientGoalsService } from '@/services/marketing/clientGoalsService';
import {
  metaCreationService,
  type CustomAudience,
  type TargetingCategory,
  type TargetingItem,
  type ChosenTargetingItem,
  type TargetingSpec,
  type TargetingList,
  type SavedAudience,
  type LocationGroup,
} from '@/services/marketing/metaCreationService';
import { suggestCopyName } from '@/components/marketing/audienceNaming';
import { LocationMapPicker, type LocationEntry } from '@/components/marketing/LocationMapPicker';
import { pinsFromOrigin } from '@/utils/marketing/geoResolve';

const CATEGORY_LABEL: Record<TargetingCategory, string> = {
  interests: 'Interesses',
  behaviors: 'Comportamentos',
  demographics: 'Dados demográficos',
};

type Bucket = 'include' | 'narrow' | 'exclude';

const BUCKET_LABEL: Record<Bucket, string> = {
  include: 'Incluir pessoas que correspondam a',
  narrow: 'Restringir ainda mais (também deve corresponder a)',
  exclude: 'Excluir pessoas que correspondam a',
};

function formatSize(item: TargetingItem): string | null {
  if (item.audience_size_lower_bound == null) return null;
  const lo = item.audience_size_lower_bound.toLocaleString('pt-BR');
  const hi = item.audience_size_upper_bound?.toLocaleString('pt-BR');
  return hi && hi !== lo ? `${lo}-${hi}` : lo;
}

function groupByCategory(items: ChosenTargetingItem[]): Partial<Record<TargetingCategory, Array<{ id: string; name: string }>>> {
  const acc: Partial<Record<TargetingCategory, Array<{ id: string; name: string }>>> = {};
  items.forEach((item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category]!.push({ id: item.id, name: item.name });
  });
  return acc;
}

function hasEntries(group: Record<string, unknown[]>): boolean {
  return Object.keys(group).length > 0;
}

interface TargetingBuilderProps {
  // Rascunho vindo do Assistente de IA da Criação Meta (ver
  // MetaCreationAiButton.tsx / aiMetaDraft.ts): preenche os campos de
  // Incluir/Restringir/Excluir e o nome do público, mas não cria nada
  // sozinho — os itens já vêm resolvidos (id/nome reais da Meta, achados
  // pela própria IA via a ferramenta buscar_direcionamento) porque o
  // usuário ainda revisa tudo aqui antes de clicar em "Criar público salvo".
  initialDraft?: {
    name?: string;
    include?: Array<{ category: TargetingCategory; id: string; name: string }>;
    narrow?: Array<{ category: TargetingCategory; id: string; name: string }>;
    exclude?: Array<{ category: TargetingCategory; id: string; name: string }>;
    ageMin?: number;
    ageMax?: number;
    genders?: Array<'male' | 'female'>;
  } | null;
}

export function TargetingBuilder({ initialDraft = null }: TargetingBuilderProps = {}) {
  // Conta e BM vêm da página (compartilhadas com Públicos e Grupos de Locais),
  // então trocar de aba não obriga a escolher a BM de novo.
  const { account, setAccount, bm: selectedBm, setBm: setSelectedBm, pickerKey: pickerResetKey, resetPicker } = useMetaAdAccountScope();

  const [category, setCategory] = useState<TargetingCategory>('interests');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 400);
  const [results, setResults] = useState<TargetingItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeBucket, setActiveBucket] = useState<Bucket>('include');

  const [include, setInclude] = useState<ChosenTargetingItem[]>([]);
  const [narrow, setNarrow] = useState<ChosenTargetingItem[]>([]);
  const [exclude, setExclude] = useState<ChosenTargetingItem[]>([]);
  const [suggestions, setSuggestions] = useState<TargetingItem[]>([]);

  const [country, setCountry] = useState('BR');
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(65);

  // Localização específica — alternativa ao país simples. Pode vir de
  // Grupos de Localização já salvos (aba "Grupos de Localização") e/ou de
  // pontos adicionados aqui mesmo no mapa. Tendo pelo menos um local
  // escolhido, o targeting usa custom_locations em vez de country.
  const [locationGroups, setLocationGroups] = useState<LocationGroup[] | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [manualLocations, setManualLocations] = useState<LocationEntry[]>([]);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);

  // Edição de uma lista de direcionamento já salva (reaproveita o mesmo
  // mini-formulário de "criar lista nova" — ver handleSaveList).
  const [editingListId, setEditingListId] = useState<string | null>(null);

  // Edição de um público salvo já existente — ao abrir, o formulário
  // inteiro (idade/gênero/localização/interesses) é recarregado com o que
  // já está salvo na Meta, e "Salvar" passa a atualizar em vez de criar.
  const [editingSavedAudienceId, setEditingSavedAudienceId] = useState<string | null>(null);
  const [loadingSavedAudienceDetail, setLoadingSavedAudienceDetail] = useState(false);
  const [gender, setGender] = useState<'all' | 'male' | 'female'>('all');

  const [reach, setReach] = useState<{ lower?: number; upper?: number } | null>(null);
  const [loadingReach, setLoadingReach] = useState(false);

  const [audienceName, setAudienceName] = useState('');
  const [savingAudience, setSavingAudience] = useState(false);

  // Públicos salvos já existentes nesta conta (pra listar e permitir
  // duplicar pra outra conta — a Graph API não lista isso automaticamente
  // em nenhum outro lugar da tela).
  const [savedAudiences, setSavedAudiences] = useState<SavedAudience[] | null>(null);
  const [loadingSavedAudiences, setLoadingSavedAudiences] = useState(false);
  // Públicos personalizados/semelhantes da conta pra misturar no público
  // salvo (no Ad Manager é "Públicos incluídos" > "Públicos personalizados").
  const [accountAudiences, setAccountAudiences] = useState<CustomAudience[] | null>(null);
  const [loadingAccountAudiences, setLoadingAccountAudiences] = useState(false);
  const [includedCustom, setIncludedCustom] = useState<CustomAudience[]>([]);
  const [customAudienceQuery, setCustomAudienceQuery] = useState('');
  const [duplicateSource, setDuplicateSource] = useState<SavedAudience | null>(null);
  const [duplicateTargetAccount, setDuplicateTargetAccount] = useState<{ id: string; name: string } | null>(null);
  // null = o diálogo ainda não perguntou se a cópia é pra mesma conta ou outra.
  const [duplicateChoice, setDuplicateChoice] = useState<'mesma' | 'outra' | null>(null);
  const [duplicateName, setDuplicateName] = useState('');
  const [duplicatingSaved, setDuplicatingSaved] = useState(false);

  // Listas de direcionamento salvas (locais ao CRM) — um recorte nomeado de
  // itens (ex: "Medicina" = médico + veterinário + estudante + enfermagem)
  // que depois pode ser puxado, no todo ou em parte, pra dentro de
  // Incluir/Restringir/Excluir na hora de montar um público de verdade.
  const [savedLists, setSavedLists] = useState<TargetingList[] | null>(null);
  const [loadingLists, setLoadingLists] = useState(false);

  const [newListName, setNewListName] = useState('');
  const [newListCategory, setNewListCategory] = useState<TargetingCategory>('interests');
  const [newListQuery, setNewListQuery] = useState('');
  const debouncedNewListQuery = useDebounce(newListQuery, 400);
  const [newListResults, setNewListResults] = useState<TargetingItem[]>([]);
  const [newListSearching, setNewListSearching] = useState(false);
  const [newListItems, setNewListItems] = useState<ChosenTargetingItem[]>([]);
  const [savingList, setSavingList] = useState(false);

  const [listSelections, setListSelections] = useState<Record<string, Set<string>>>({});

  const loadLists = () => {
    setLoadingLists(true);
    metaCreationService
      .listTargetingLists()
      .then(setSavedLists)
      .catch(() => toast.error('Erro ao carregar as listas de direcionamento'))
      .finally(() => setLoadingLists(false));
  };

  useEffect(() => {
    loadLists();
  }, []);

  useEffect(() => {
    if (!debouncedNewListQuery.trim()) {
      setNewListResults([]);
      return;
    }
    setNewListSearching(true);
    metaCreationService
      .searchTargeting(newListCategory, debouncedNewListQuery.trim())
      .then(setNewListResults)
      .catch(() => toast.error('Erro ao buscar direcionamento'))
      .finally(() => setNewListSearching(false));
  }, [newListCategory, debouncedNewListQuery]);

  const newListChosenIds = useMemo(() => new Set(newListItems.map((i) => i.id)), [newListItems]);
  const visibleNewListResults = newListResults.filter((item) => !newListChosenIds.has(item.id));

  const addToNewListDraft = (item: TargetingItem) => {
    setNewListItems((prev) => (prev.some((i) => i.id === item.id) ? prev : [...prev, { ...item, category: newListCategory }]));
  };
  const removeFromNewListDraft = (id: string) => setNewListItems((prev) => prev.filter((i) => i.id !== id));

  const handleSaveList = async () => {
    if (!newListName.trim()) {
      toast.error('Informe um nome para a lista');
      return;
    }
    if (newListItems.length === 0) {
      toast.error('Adicione ao menos um item à lista');
      return;
    }
    setSavingList(true);
    try {
      if (editingListId) {
        await metaCreationService.updateTargetingList(editingListId, { name: newListName.trim(), items: newListItems });
        toast.success('Lista atualizada!');
        setEditingListId(null);
      } else {
        await metaCreationService.createTargetingList(newListName.trim(), newListItems);
        toast.success('Lista salva!');
      }
      setNewListName('');
      setNewListItems([]);
      setNewListQuery('');
      loadLists();
    } catch {
      toast.error(editingListId ? 'Erro ao atualizar a lista' : 'Erro ao salvar a lista');
    } finally {
      setSavingList(false);
    }
  };

  // Reaproveita o mesmo mini-formulário de "criar lista nova" pra editar
  // uma já salva — handleSaveList detecta editingListId e chama update em
  // vez de create.
  const handleEditList = (list: TargetingList) => {
    setEditingListId(list.id);
    setNewListName(list.name);
    setNewListItems(list.items);
    setNewListQuery('');
  };

  const cancelEditList = () => {
    setEditingListId(null);
    setNewListName('');
    setNewListItems([]);
    setNewListQuery('');
  };

  const handleDeleteList = async (id: string) => {
    try {
      await metaCreationService.deleteTargetingList(id);
      setSavedLists((prev) => (prev || []).filter((l) => l.id !== id));
      if (editingListId === id) cancelEditList();
    } catch {
      toast.error('Erro ao excluir a lista');
    }
  };

  const toggleListItemSelection = (listId: string, itemId: string) => {
    setListSelections((prev) => {
      const current = new Set(prev[listId] || []);
      if (current.has(itemId)) current.delete(itemId);
      else current.add(itemId);
      return { ...prev, [listId]: current };
    });
  };

  // Busca ao digitar (categoria atual)
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    metaCreationService
      .searchTargeting(category, debouncedQuery.trim())
      .then(setResults)
      .catch(() => toast.error('Erro ao buscar direcionamento'))
      .finally(() => setSearching(false));
  }, [category, debouncedQuery]);

  useEffect(() => {
    if (!initialDraft) return;
    const toChosen = (arr?: Array<{ category: TargetingCategory; id: string; name: string }>): ChosenTargetingItem[] =>
      (arr || []).map((item) => ({ id: item.id, name: item.name, category: item.category }));
    if (initialDraft.include) setInclude(toChosen(initialDraft.include));
    if (initialDraft.narrow) setNarrow(toChosen(initialDraft.narrow));
    if (initialDraft.exclude) setExclude(toChosen(initialDraft.exclude));
    if (typeof initialDraft.ageMin === 'number') setAgeMin(initialDraft.ageMin);
    if (typeof initialDraft.ageMax === 'number') setAgeMax(initialDraft.ageMax);
    if (initialDraft.genders) setGender(initialDraft.genders.length === 1 ? initialDraft.genders[0] : 'all');
    if (initialDraft.name) setAudienceName(initialDraft.name);
  }, [initialDraft]);

  // Grupos de localização da conta (aba "Grupos de Localização") — pra
  // marcar aqui e reaproveitar os mesmos pins em vez de digitar de novo.
  useEffect(() => {
    if (!account) {
      setLocationGroups(null);
      setSelectedGroupIds(new Set());
      return;
    }
    metaCreationService
      .listLocationGroups(account.id)
      .then(setLocationGroups)
      .catch(() => setLocationGroups([]));
  }, [account]);

  // Junta os pins dos grupos marcados com os adicionados manualmente no
  // mapa, sem duplicar o mesmo ponto (mesma coordenada+raio).
  const pickedLocations = useMemo(() => {
    const fromGroups: LocationEntry[] = (locationGroups || [])
      .filter((g) => selectedGroupIds.has(g.id))
      .flatMap((g) =>
        g.pins
          .filter((p) => !p.exclude)
          .map((p) => ({ id: `grupo-${g.id}-${p.name}`, name: p.name, lat: p.lat, lng: p.lng, radius: p.radius })),
      );
    const chave = (l: LocationEntry) => `${l.lat.toFixed(4)}|${l.lng.toFixed(4)}|${l.radius}`;
    const vistos = new Set<string>();
    const resultado: LocationEntry[] = [];
    [...fromGroups, ...manualLocations].forEach((l) => {
      const k = chave(l);
      if (vistos.has(k)) return;
      vistos.add(k);
      resultado.push(l);
    });
    return resultado;
  }, [locationGroups, selectedGroupIds, manualLocations]);

  const buildSpec = useMemo((): TargetingSpec => {
    const spec: TargetingSpec = {
      geo_locations:
        pickedLocations.length > 0
          ? {
              custom_locations: pickedLocations.map((l) => ({
                latitude: l.lat,
                longitude: l.lng,
                radius: l.radius,
                distance_unit: 'kilometer',
              })),
            }
          : { countries: [country.trim() || 'BR'] },
      age_min: ageMin,
      age_max: ageMax,
    };
    if (gender !== 'all') spec.genders = [gender === 'male' ? 1 : 2];

    const includeGroup = groupByCategory(include);
    const narrowGroup = groupByCategory(narrow);
    const flexible: TargetingSpec['flexible_spec'] = [];
    if (hasEntries(includeGroup)) flexible.push(includeGroup as never);
    if (hasEntries(narrowGroup)) flexible.push(narrowGroup as never);
    if (flexible.length) spec.flexible_spec = flexible;

    const excludeGroup = groupByCategory(exclude);
    if (hasEntries(excludeGroup)) spec.exclusions = excludeGroup;

    // A Graph API espera só os ids em `custom_audiences` (o nome fica de
    // fora — ela resolve pelo id, que é por conta).
    if (includedCustom.length > 0) spec.custom_audiences = includedCustom.map((a) => ({ id: a.id }));

    return spec;
  }, [country, pickedLocations, ageMin, ageMax, gender, include, narrow, exclude, includedCustom]);

  const debouncedSpec = useDebounce(buildSpec, 600);

  // Estimativa de alcance ao vivo — só depois de ter pelo menos um item
  // escolhido (senão é só "todo mundo no país", pouco útil como feedback).
  useEffect(() => {
    if (!account || (include.length === 0 && narrow.length === 0 && includedCustom.length === 0)) {
      setReach(null);
      return;
    }
    setLoadingReach(true);
    metaCreationService
      .estimateReach(account.id, debouncedSpec)
      .then((r) =>
        setReach({
          lower: r.estimate_mau_lower_bound ?? r.estimate_dau_lower_bound,
          upper: r.estimate_mau_upper_bound ?? r.estimate_dau_upper_bound,
        }),
      )
      .catch(() => setReach(null))
      .finally(() => setLoadingReach(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, debouncedSpec]);

  const bucketState = { include, narrow, exclude } as const;
  const bucketSetters = { include: setInclude, narrow: setNarrow, exclude: setExclude } as const;

  // Sem nenhum item marcado, "adicionar" leva a lista inteira — marcar
  // alguns restringe ao subconjunto escolhido, exatamente o comportamento
  // pedido ("se eu quiser montar um público só com dois dessa lista tudo
  // bem, se quiser montar mais tudo bem").
  const addListSelectionToBucket = (list: TargetingList) => {
    const selected = listSelections[list.id];
    const itemsToAdd = selected && selected.size > 0 ? list.items.filter((i) => selected.has(i.id)) : list.items;
    if (itemsToAdd.length === 0) return;
    bucketSetters[activeBucket]((prev) => {
      const existingIds = new Set(prev.map((i) => i.id));
      const additions = itemsToAdd.filter((i) => !existingIds.has(i.id));
      return [...prev, ...additions];
    });
    toast.success(`${itemsToAdd.length} item(ns) adicionados em "${BUCKET_LABEL[activeBucket]}"`);
  };

  // Um item escolhido em QUALQUER grupo some da lista de resultados — não
  // faz sentido oferecer pra adicionar de novo em Incluir/Restringir/Excluir
  // ao mesmo tempo, e evita a sensação de "cliquei e não aconteceu nada".
  const chosenIds = useMemo(
    () => new Set([...include, ...narrow, ...exclude].map((i) => i.id)),
    [include, narrow, exclude],
  );
  const visibleResults = results.filter((item) => !chosenIds.has(item.id));

  const addItem = (item: TargetingItem) => {
    const chosen: ChosenTargetingItem = { ...item, category };
    const list = bucketState[activeBucket];
    if (list.some((i) => i.id === chosen.id)) return;
    bucketSetters[activeBucket]((prev) => [...prev, chosen]);

    if (activeBucket === 'include' && category === 'interests') {
      const names = [...include.filter((i) => i.category === 'interests').map((i) => i.name), item.name];
      metaCreationService
        .getTargetingSuggestions(names)
        .then(setSuggestions)
        .catch(() => setSuggestions([]));
    }
  };

  const removeItem = (bucket: Bucket, id: string) => {
    bucketSetters[bucket]((prev) => prev.filter((i) => i.id !== id));
  };

  const loadSavedAudiences = (accountId: string) => {
    setLoadingSavedAudiences(true);
    metaCreationService
      .listSavedAudiences(accountId)
      .then(setSavedAudiences)
      .catch(() => toast.error('Erro ao carregar públicos salvos'))
      .finally(() => setLoadingSavedAudiences(false));
  };

  useEffect(() => {
    if (account) loadSavedAudiences(account.id);
  }, [account]);

  // Os públicos personalizados/semelhantes vivem na conta de anúncio, não na
  // BM — por isso a lista recarrega junto com a troca de conta.
  useEffect(() => {
    if (!account) {
      setAccountAudiences(null);
      setIncludedCustom([]);
      return;
    }
    setLoadingAccountAudiences(true);
    setAccountAudiences(null);
    setIncludedCustom([]);
    metaCreationService
      .listAudiences(account.id)
      .then(setAccountAudiences)
      .catch(() => {
        setAccountAudiences([]);
        toast.error('Erro ao carregar os públicos da conta');
      })
      .finally(() => setLoadingAccountAudiences(false));
  }, [account]);

  const filteredAccountAudiences = useMemo(() => {
    const query = customAudienceQuery.trim().toLowerCase();
    return (accountAudiences || []).filter((a) => !query || a.name.toLowerCase().includes(query));
  }, [accountAudiences, customAudienceQuery]);

  const toggleCustomAudience = (audience: CustomAudience) => {
    setIncludedCustom((prev) =>
      prev.some((a) => a.id === audience.id) ? prev.filter((a) => a.id !== audience.id) : [...prev, audience],
    );
  };

  const handleSaveAudience = async () => {
    if (!account) return;
    if (!audienceName.trim()) {
      toast.error('Informe um nome para o público');
      return;
    }
    setSavingAudience(true);
    try {
      if (editingSavedAudienceId) {
        await metaCreationService.updateSavedAudience(editingSavedAudienceId, audienceName.trim(), buildSpec);
        toast.success('Público salvo atualizado na Meta!');
        setEditingSavedAudienceId(null);
      } else {
        await metaCreationService.createSavedAudience(account.id, audienceName.trim(), buildSpec);
        toast.success('Público salvo na Meta! Já pode ser usado em novas campanhas.');
        setAudienceName('');
      }
      loadSavedAudiences(account.id);
    } catch {
      toast.error(editingSavedAudienceId ? 'Erro ao atualizar o público na Meta' : 'Erro ao salvar o público na Meta');
    } finally {
      setSavingAudience(false);
    }
  };

  // Extrai os itens de um flexible_spec (Incluir/Restringir) — a Graph API
  // devolve um array com 1 ou 2 grupos; por convenção (mesma ordem que
  // buildSpec monta) o primeiro é sempre "incluir" e o segundo, se existir,
  // é "restringir ainda mais".
  const itemsFromGroup = (
    group: Partial<Record<TargetingCategory, Array<{ id: string; name: string }>>> | undefined,
  ): ChosenTargetingItem[] => {
    if (!group) return [];
    const out: ChosenTargetingItem[] = [];
    (Object.keys(group) as TargetingCategory[]).forEach((cat) => {
      (group[cat] || []).forEach((item) => out.push({ id: item.id, name: item.name, category: cat }));
    });
    return out;
  };

  // Carrega um público salvo já existente no formulário inteiro pra editar
  // — localização, idade, gênero, interesses e públicos incluídos ficam
  // exatamente como estão salvos na Meta, prontos pra ajustar e sobrescrever.
  const handleEditSavedAudience = async (audience: SavedAudience) => {
    if (loadingSavedAudienceDetail) return;
    setLoadingSavedAudienceDetail(true);
    try {
      const detail = await metaCreationService.getSavedAudienceDetail(audience.id);
      const t = detail.targeting;
      setAgeMin(t.age_min ?? 18);
      setAgeMax(t.age_max ?? 65);
      setGender(t.genders?.[0] === 1 ? 'male' : t.genders?.[0] === 2 ? 'female' : 'all');
      setCountry(t.geo_locations?.countries?.[0] || 'BR');

      const flexible = t.flexible_spec || [];
      setInclude(itemsFromGroup(flexible[0]));
      setNarrow(itemsFromGroup(flexible[1]));
      setExclude(itemsFromGroup(t.exclusions));

      const customIds = new Set((t.custom_audiences || []).map((a) => a.id));
      setIncludedCustom((accountAudiences || []).filter((a) => customIds.has(a.id)));

      // Localização específica (cidades/lugares sem coordenada + pins com
      // coordenada) — vira tudo "manual" aqui: não dá pra saber se veio de
      // um Grupo de Localização, então reaproveita pinsFromOrigin (mesma
      // lógica já usada em "Importar de públicos salvos" nos Grupos).
      const geo = t.geo_locations || {};
      const unresolved: string[] = [];
      const origins = [
        ...(geo.cities || []),
        ...(geo.places || []),
        ...(geo.custom_locations || []).map((c) => ({ lat: c.latitude, lng: c.longitude, radius: c.radius })),
      ];
      const resolved = await pinsFromOrigin(origins, unresolved);
      setSelectedGroupIds(new Set());
      setManualLocations(resolved);
      if (unresolved.length) {
        toast.warning(`${unresolved.length} localização(ões) salva(s) não foi(ram) encontrada(s) — confira antes de salvar.`);
      }

      setAudienceName(detail.name);
      setEditingSavedAudienceId(audience.id);
    } catch {
      toast.error('Erro ao carregar o público salvo pra edição');
    } finally {
      setLoadingSavedAudienceDetail(false);
    }
  };

  const cancelEditSavedAudience = () => {
    setEditingSavedAudienceId(null);
    setAudienceName('');
  };

  const openDuplicateSaved = (audience: SavedAudience) => {
    setDuplicateSource(audience);
    setDuplicateTargetAccount(null);
    setDuplicateChoice(null);
    // Mesmo nome do original; o "- Cópia" só entra se o nome já existir na conta
    // de destino (e a conta de destino ainda é desconhecida aqui — é ajustado
    // no passo seguinte).
    setDuplicateName(audience.name);
  };

  // Nome da cópia do público salvo: só a mesma conta dá pra conferir conflito
  // de nome; em outra conta a Meta aceita o mesmo nome sem problema.
  useEffect(() => {
    if (!duplicateSource || !duplicateTargetAccount) return;
    const sameAccount = duplicateTargetAccount.id === account?.id;
    const taken = sameAccount ? (savedAudiences || []).map((sa) => sa.name) : [];
    setDuplicateName(suggestCopyName(duplicateSource.name, taken));
  }, [duplicateSource, duplicateTargetAccount, account, savedAudiences]);

  // Públicos incluídos são por conta: os ids da origem não existem no destino,
  // então a cópia para outra conta vem sem eles (e a UI avisa) em vez de a
  // Graph API rejeitar o payload inteiro.
  const savedAudienceCustomIds = (audience: SavedAudience | null) => audience?.targeting?.custom_audiences ?? [];
  const duplicateLosesCustomAudiences =
    Boolean(duplicateSource) &&
    savedAudienceCustomIds(duplicateSource).length > 0 &&
    Boolean(duplicateTargetAccount) &&
    duplicateTargetAccount?.id !== account?.id;

  const handleDuplicateSaved = async () => {
    if (!duplicateSource || !duplicateTargetAccount) return;
    if (!duplicateName.trim()) {
      toast.error('Informe um nome para a cópia');
      return;
    }
    setDuplicatingSaved(true);
    try {
      const overrides: { name: string; targeting?: TargetingSpec } = { name: duplicateName.trim() };
      if (duplicateLosesCustomAudiences) {
        const rest = { ...duplicateSource.targeting };
        delete rest.custom_audiences;
        overrides.targeting = rest;
      }
      await metaCreationService.duplicateSavedAudience({
        sourceAudienceId: duplicateSource.id,
        targetAccountId: duplicateTargetAccount.id,
        overrides,
      });
      toast.success(
        duplicateLosesCustomAudiences
          ? 'Público salvo duplicado (os públicos incluídos não são copiados entre contas — adicione de novo).'
          : 'Público salvo duplicado!',
      );
      setDuplicateSource(null);
      if (duplicateTargetAccount.id === account?.id) loadSavedAudiences(account.id);
    } catch {
      toast.error('Erro ao duplicar o público salvo');
    } finally {
      setDuplicatingSaved(false);
    }
  };

  const renderBucketChips = (bucket: Bucket) => (
    <div className="flex flex-wrap gap-1.5 min-h-[1.75rem]">
      {bucketState[bucket].length === 0 ? (
        <span className="text-xs text-muted-foreground">Nenhum item ainda.</span>
      ) : (
        bucketState[bucket].map((item) => (
          <Badge key={`${bucket}-${item.id}`} variant="outline" className="gap-1">
            {item.name}
            <button type="button" onClick={() => removeItem(bucket, item.id)}>
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {!account ? (
        <MetaScopedEntityPicker
          stepTwoLabel="Conta de anúncio"
          fetchStepTwo={(bmId) => clientGoalsService.listAdAccountsForBm(bmId)}
          onSelect={setAccount}
          selectedBm={selectedBm}
          onSelectBm={setSelectedBm}
          resetKey={pickerResetKey}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Mesma trilha do Painel Tráfego: o nome da BM e o da conta são
              atalhos. Clicar na BM volta pra seleção de BM; clicar na conta
              volta pra lista de contas DESSA BM (não mais pro topo). */}
          <div className="lg:col-span-2 flex items-center gap-2 flex-wrap text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
              <Users2 className="w-3.5 h-3.5" />
            </span>
            {selectedBm && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setAccount(null);
                    setSelectedBm(null);
                  }}
                  className="text-primary hover:underline break-words min-w-0"
                  title={selectedBm.name}
                >
                  {selectedBm.name}
                </button>
                <span className="text-muted-foreground/60">/</span>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setAccount(null);
                resetPicker();
              }}
              className="text-primary hover:underline break-words min-w-0"
              title={account.name}
            >
              {account.name}
            </button>
          </div>
          {/* Coluna esquerda: básico + busca */}
          <div className="space-y-4">
            <section className="rounded-lg border border-border bg-card p-4 space-y-3">
              <h4 className="text-sm font-semibold">Localização, idade e gênero</h4>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label>Localização</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setMapPickerOpen(true)}>
                    <MapPin className="w-3.5 h-3.5 mr-1" /> Adicionar no mapa
                  </Button>
                </div>

                {pickedLocations.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {pickedLocations.map((l) => {
                      const isManual = manualLocations.some((m) => m.id === l.id);
                      return (
                        <Badge key={l.id} variant="outline" className="gap-1">
                          {l.name} ({l.radius}km)
                          {isManual && (
                            <button
                              type="button"
                              onClick={() => setManualLocations((prev) => prev.filter((m) => m.id !== l.id))}
                              title="Remover"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </Badge>
                      );
                    })}
                  </div>
                ) : (
                  <div className="max-w-[140px]">
                    <Input
                      value={country}
                      onChange={(e) => setCountry(e.target.value.toUpperCase())}
                      maxLength={2}
                      placeholder="País (ex: BR)"
                    />
                  </div>
                )}

                {locationGroups && locationGroups.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <Label className="text-xs text-muted-foreground">Ou escolha um grupo de localização já salvo:</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {locationGroups.map((g) => (
                        <label
                          key={g.id}
                          className="flex items-center gap-1 text-xs px-1.5 py-1 rounded border cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedGroupIds.has(g.id)}
                            onCheckedChange={() =>
                              setSelectedGroupIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(g.id)) next.delete(g.id);
                                else next.add(g.id);
                                return next;
                              })
                            }
                          />
                          {g.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {pickedLocations.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Usando localização específica — o campo País acima fica sem efeito enquanto houver pelo menos um
                    local escolhido.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Idade mín.</Label>
                  <Input type="number" min={13} max={65} value={ageMin} onChange={(e) => setAgeMin(Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Idade máx.</Label>
                  <Input type="number" min={13} max={65} value={ageMax} onChange={(e) => setAgeMax(Number(e.target.value))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Gênero</Label>
                <Select value={gender} onValueChange={(v) => setGender(v as typeof gender)}>
                  <SelectTrigger className="max-w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="male">Masculino</SelectItem>
                    <SelectItem value="female">Feminino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </section>

            <section className="rounded-lg border border-border bg-card p-4 space-y-3">
              <h4 className="text-sm font-semibold">Buscar direcionamento</h4>
              <div className="flex gap-2">
                <Select value={category} onValueChange={(v) => setCategory(v as TargetingCategory)}>
                  <SelectTrigger className="w-44 shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="interests">Interesses</SelectItem>
                    <SelectItem value="behaviors">Comportamentos</SelectItem>
                    <SelectItem value="demographics">Dados demográficos</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={`Buscar ${CATEGORY_LABEL[category].toLowerCase()}...`}
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Adicionar em:</Label>
                <Select value={activeBucket} onValueChange={(v) => setActiveBucket(v as Bucket)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="include">Incluir</SelectItem>
                    <SelectItem value="narrow">Restringir ainda mais</SelectItem>
                    <SelectItem value="exclude">Excluir</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="max-h-56 overflow-y-auto border rounded-md divide-y">
                {searching ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Buscando...</p>
                ) : visibleResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {query ? 'Nenhum resultado.' : 'Digite acima pra buscar.'}
                  </p>
                ) : (
                  visibleResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addItem(item)}
                      className="w-full flex items-center justify-between gap-2 p-2 text-sm text-left hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate">{item.name}</p>
                        {item.path && item.path.length > 0 && (
                          <p className="text-[0.65rem] text-muted-foreground truncate">{item.path.join(' > ')}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {formatSize(item) && (
                          <span className="text-[0.65rem] text-muted-foreground">{formatSize(item)}</span>
                        )}
                        <Plus className="w-3.5 h-3.5 text-primary" />
                      </div>
                    </button>
                  ))
                )}
              </div>

              {suggestions.length > 0 && (
                <div className="space-y-1.5 pt-1 border-t">
                  <Label className="text-xs flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Sugestões relacionadas
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions
                      .filter((s) => !include.some((i) => i.id === s.id))
                      .slice(0, 10)
                      .map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setInclude((prev) => [...prev, { ...s, category: 'interests' }])}
                          className="text-xs px-2 py-1 rounded-full border border-dashed hover:bg-muted/40"
                        >
                          + {s.name}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-lg border border-border bg-card p-4 space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <ListPlus className="w-4 h-4" /> Listas de direcionamento
              </h4>
              <p className="text-xs text-muted-foreground">
                Monte um recorte nomeado de itens (ex: "Medicina" com Médico, Veterinário, Estudante...) pra
                reaproveitar depois — ao usar, dá pra puxar a lista inteira ou só alguns itens marcados.
              </p>

              <div className="space-y-2 rounded-md border border-dashed p-2">
                <Input value={newListName} onChange={(e) => setNewListName(e.target.value)} placeholder="Nome da lista" />
                <div className="flex gap-2">
                  <Select value={newListCategory} onValueChange={(v) => setNewListCategory(v as TargetingCategory)}>
                    <SelectTrigger className="w-44 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="interests">Interesses</SelectItem>
                      <SelectItem value="behaviors">Comportamentos</SelectItem>
                      <SelectItem value="demographics">Dados demográficos</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={newListQuery}
                      onChange={(e) => setNewListQuery(e.target.value)}
                      placeholder="Buscar pra adicionar à lista..."
                      className="pl-8"
                    />
                  </div>
                </div>

                {newListQuery.trim() && (
                  <div className="max-h-40 overflow-y-auto border rounded-md divide-y">
                    {newListSearching ? (
                      <p className="text-sm text-muted-foreground text-center py-3">Buscando...</p>
                    ) : visibleNewListResults.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-3">Nenhum resultado.</p>
                    ) : (
                      visibleNewListResults.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => addToNewListDraft(item)}
                          className="w-full flex items-center justify-between gap-2 p-2 text-sm text-left hover:bg-muted/40"
                        >
                          <span className="truncate">{item.name}</span>
                          <Plus className="w-3.5 h-3.5 text-primary shrink-0" />
                        </button>
                      ))
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 min-h-[1.75rem]">
                  {newListItems.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Nenhum item ainda.</span>
                  ) : (
                    newListItems.map((item) => (
                      <Badge key={item.id} variant="outline" className="gap-1">
                        {item.name}
                        <button type="button" onClick={() => removeFromNewListDraft(item.id)}>
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={handleSaveList} disabled={savingList}>
                    {savingList ? 'Salvando...' : editingListId ? 'Salvar alterações' : 'Salvar lista'}
                  </Button>
                  {editingListId && (
                    <Button size="sm" variant="ghost" onClick={cancelEditList}>
                      Cancelar edição
                    </Button>
                  )}
                </div>
              </div>

              {loadingLists ? (
                <p className="text-sm text-muted-foreground text-center py-3">Carregando listas...</p>
              ) : savedLists && savedLists.length > 0 ? (
                <div className="space-y-2">
                  {savedLists.map((list) => {
                    const selected = listSelections[list.id] || new Set<string>();
                    return (
                      <div key={list.id} className="rounded-md border p-2 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <h5 className="text-sm font-medium truncate">{list.name}</h5>
                          <div className="flex items-center gap-2 shrink-0">
                            <button type="button" onClick={() => handleEditList(list)} title="Editar lista">
                              <Pencil className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
                            </button>
                            <button type="button" onClick={() => handleDeleteList(list.id)} title="Excluir lista">
                              <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {list.items.map((item) => (
                            <label
                              key={item.id}
                              className="flex items-center gap-1 text-xs px-1.5 py-1 rounded border cursor-pointer"
                            >
                              <Checkbox
                                checked={selected.has(item.id)}
                                onCheckedChange={() => toggleListItemSelection(list.id, item.id)}
                              />
                              {item.name}
                            </label>
                          ))}
                        </div>
                        <Button size="sm" variant="outline" onClick={() => addListSelectionToBucket(list)}>
                          <Plus className="w-3 h-3 mr-1" />
                          {selected.size > 0 ? `Adicionar ${selected.size} selecionado(s)` : 'Adicionar lista inteira'} em "
                          {BUCKET_LABEL[activeBucket].split(' ')[0]}"
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">Nenhuma lista salva ainda.</p>
              )}
            </section>
          </div>

          {/* Coluna direita: grupos escolhidos + estimativa + salvar */}
          <div className="space-y-4">
            {(['include', 'narrow', 'exclude'] as Bucket[]).map((bucket) => (
              <section key={bucket} className="rounded-lg border border-border bg-card p-4 space-y-2">
                <h4 className="text-sm font-semibold">{BUCKET_LABEL[bucket]}</h4>
                {renderBucketChips(bucket)}
              </section>
            ))}

            <section className="rounded-lg border border-border bg-card p-4 space-y-2">
              <h4 className="text-sm font-semibold">Tamanho estimado do público</h4>
              {loadingReach ? (
                <p className="text-sm text-muted-foreground">Calculando...</p>
              ) : reach?.lower != null ? (
                <p className="text-lg font-semibold text-primary">
                  {reach.lower.toLocaleString('pt-BR')}
                  {reach.upper && reach.upper !== reach.lower ? ` - ${reach.upper.toLocaleString('pt-BR')}` : ''}{' '}
                  <span className="text-xs font-normal text-muted-foreground">pessoas/mês</span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Adicione ao menos um item pra estimar.</p>
              )}
            </section>

            <section className="rounded-lg border border-border bg-card p-4 space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <Users2 className="w-4 h-4" /> Públicos incluídos
              </h4>
              <p className="text-xs text-muted-foreground">
                Mistura públicos personalizados e semelhantes da conta dentro do público salvo — o mesmo
                "Públicos incluídos &gt; Públicos personalizados" do Gerenciador de Anúncios.
              </p>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={customAudienceQuery}
                  onChange={(e) => setCustomAudienceQuery(e.target.value)}
                  placeholder="Buscar públicos da conta..."
                  className="pl-8"
                />
              </div>

              {includedCustom.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {includedCustom.map((a) => (
                    <Badge key={a.id} variant="outline" className="gap-1">
                      {a.name}
                      <button
                        type="button"
                        onClick={() => toggleCustomAudience(a)}
                        className="hover:text-destructive"
                        title="Remover"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
                {loadingAccountAudiences ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
                ) : filteredAccountAudiences.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4 px-2">
                    {accountAudiences?.length
                      ? 'Nenhum público com esse nome.'
                      : 'Esta conta ainda não tem públicos personalizados.'}
                  </p>
                ) : (
                  filteredAccountAudiences.map((a) => (
                    <label
                      key={a.id}
                      className="flex items-center gap-2 p-2 text-sm cursor-pointer hover:bg-muted/40"
                    >
                      <Checkbox
                        checked={includedCustom.some((i) => i.id === a.id)}
                        onCheckedChange={() => toggleCustomAudience(a)}
                      />
                      <span className="min-w-0 flex-1 truncate" title={a.name}>
                        {a.name}
                      </span>
                      <span className="text-[0.65rem] text-muted-foreground shrink-0">
                        {a.subtype === 'LOOKALIKE' ? 'Semelhante' : a.subtype === 'CUSTOM' ? 'Clientes' : 'Personalizado'}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-lg border border-border bg-card p-4 space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                {editingSavedAudienceId ? (
                  <>
                    <Pencil className="w-4 h-4" /> Editando público salvo
                  </>
                ) : (
                  'Salvar como público reutilizável'
                )}
              </h4>
              <div className="flex gap-2">
                <Input
                  value={audienceName}
                  onChange={(e) => setAudienceName(e.target.value)}
                  placeholder="Nome do público"
                />
                <Button onClick={handleSaveAudience} disabled={savingAudience}>
                  {savingAudience ? 'Salvando...' : editingSavedAudienceId ? 'Salvar alterações' : 'Salvar'}
                </Button>
                {editingSavedAudienceId && (
                  <Button variant="ghost" onClick={cancelEditSavedAudience}>
                    <XCircle className="w-3.5 h-3.5 mr-1" /> Cancelar
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {editingSavedAudienceId
                  ? 'Sobrescreve o direcionamento deste público na Meta — conjuntos de anúncios que já usam ele passam a usar a versão nova.'
                  : 'Fica disponível pra usar em qualquer campanha nova, direto no Gerenciador de Anúncios da Meta.'}
              </p>
            </section>

            <section className="rounded-lg border border-border bg-card p-4 space-y-2">
              <h4 className="text-sm font-semibold">Públicos salvos nesta conta</h4>
              {loadingSavedAudiences ? (
                <p className="text-sm text-muted-foreground text-center py-3">Carregando...</p>
              ) : !savedAudiences || savedAudiences.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">Nenhum público salvo ainda.</p>
              ) : (
                <div className="space-y-2">
                  {savedAudiences.map((sa) => (
                    <div key={sa.id} className="rounded-md border p-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" title={sa.name}>
                          {sa.name}
                        </p>
                        {sa.approximate_count != null && (
                          <p className="text-xs text-muted-foreground">
                            {sa.approximate_count.toLocaleString('pt-BR')} pessoas
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditSavedAudience(sa)}
                          disabled={loadingSavedAudienceDetail}
                        >
                          <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openDuplicateSaved(sa)}>
                          <Copy className="w-3.5 h-3.5 mr-1" /> Duplicar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      <Dialog open={mapPickerOpen} onOpenChange={setMapPickerOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar localização no mapa</DialogTitle>
            <DialogDescription>Marque um ponto e ajuste o raio — soma aos locais já escolhidos.</DialogDescription>
          </DialogHeader>
          <LocationMapPicker locations={manualLocations} onChange={setManualLocations} singleListMode />
          <DialogFooter>
            <Button onClick={() => setMapPickerOpen(false)}>Concluído</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(duplicateSource)}
        onOpenChange={(open) => {
          if (open) return;
          setDuplicateSource(null);
          setDuplicateTargetAccount(null);
          setDuplicateChoice(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Duplicar público salvo</DialogTitle>
            <DialogDescription>
              Escolha se a cópia vai para a mesma conta ou para outra — o direcionamento (localização, idade,
              interesses) é copiado como está.
            </DialogDescription>
          </DialogHeader>

          {!duplicateTargetAccount && !duplicateChoice ? (
            /* Passo 1 — pergunta antes de qualquer coisa: mesma conta ou outra? */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={!account}
                onClick={() => {
                  setDuplicateChoice('mesma');
                  if (account) setDuplicateTargetAccount(account);
                }}
                className="text-left rounded-lg border border-border bg-card p-4 space-y-1 hover:border-primary/50 hover:bg-muted/40 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <h4 className="text-sm font-semibold break-words">Mesma conta</h4>
                <p className="text-xs text-muted-foreground break-words">
                  {account?.name || 'A conta onde você está agora'}
                </p>
              </button>
              <button
                type="button"
                onClick={() => setDuplicateChoice('outra')}
                className="text-left rounded-lg border border-border bg-card p-4 space-y-1 hover:border-primary/50 hover:bg-muted/40 transition-colors"
              >
                <h4 className="text-sm font-semibold break-words">Outra conta</h4>
                <p className="text-xs text-muted-foreground">Escolher a conta de destino (BM &gt; Conta de anúncio)</p>
              </button>
            </div>
          ) : !duplicateTargetAccount ? (
            <div className="space-y-3">
              <Button variant="ghost" size="sm" onClick={() => setDuplicateChoice(null)}>
                <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Voltar
              </Button>
              <MetaScopedEntityPicker
                compact
                stepTwoLabel="Conta de anúncio"
                fetchStepTwo={(bmId) => clientGoalsService.listAdAccountsForBm(bmId)}
                onSelect={setDuplicateTargetAccount}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                <span className="text-sm min-w-0 break-words">
                  Conta de destino: <span className="font-medium">{duplicateTargetAccount.name}</span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    setDuplicateTargetAccount(null);
                    setDuplicateChoice(null);
                  }}
                >
                  Trocar
                </Button>
              </div>
              <div className="space-y-1.5">
                <Label>Nome da cópia</Label>
                <Input value={duplicateName} onChange={(e) => setDuplicateName(e.target.value)} />
              </div>
              {duplicateLosesCustomAudiences && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  Este público tem {savedAudienceCustomIds(duplicateSource).length} público(s) personalizado(s)
                  incluído(s). Eles pertencem à conta de origem, então a cópia vai sem eles — adicione de novo na
                  conta de destino.
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateSource(null)} disabled={duplicatingSaved}>
              Cancelar
            </Button>
            {duplicateTargetAccount && (
              <Button onClick={handleDuplicateSaved} disabled={duplicatingSaved}>
                {duplicatingSaved ? 'Duplicando...' : 'Criar cópia'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
