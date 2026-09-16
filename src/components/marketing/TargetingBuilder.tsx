import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Button,
  Input,
  Label,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@evoapi/design-system';
import { Plus, X, Search, Users2, Sparkles } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { MetaAdAccountPicker } from '@/components/marketing/MetaAdAccountPicker';
import {
  metaCreationService,
  type TargetingCategory,
  type TargetingItem,
  type ChosenTargetingItem,
  type TargetingSpec,
} from '@/services/marketing/metaCreationService';

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

export function TargetingBuilder() {
  const [account, setAccount] = useState<{ id: string; name: string } | null>(null);

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
  const [gender, setGender] = useState<'all' | 'male' | 'female'>('all');

  const [reach, setReach] = useState<{ lower?: number; upper?: number } | null>(null);
  const [loadingReach, setLoadingReach] = useState(false);

  const [audienceName, setAudienceName] = useState('');
  const [savingAudience, setSavingAudience] = useState(false);

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

  const buildSpec = useMemo((): TargetingSpec => {
    const spec: TargetingSpec = {
      geo_locations: { countries: [country.trim() || 'BR'] },
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

    return spec;
  }, [country, ageMin, ageMax, gender, include, narrow, exclude]);

  const debouncedSpec = useDebounce(buildSpec, 600);

  // Estimativa de alcance ao vivo — só depois de ter pelo menos um item
  // escolhido (senão é só "todo mundo no país", pouco útil como feedback).
  useEffect(() => {
    if (!account || (include.length === 0 && narrow.length === 0)) {
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

  const handleSaveAudience = async () => {
    if (!account) return;
    if (!audienceName.trim()) {
      toast.error('Informe um nome para o público');
      return;
    }
    setSavingAudience(true);
    try {
      await metaCreationService.createSavedAudience(account.id, audienceName.trim(), buildSpec);
      toast.success('Público salvo na Meta! Já pode ser usado em novas campanhas.');
      setAudienceName('');
    } catch {
      toast.error('Erro ao salvar o público na Meta');
    } finally {
      setSavingAudience(false);
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
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <MetaAdAccountPicker onSelect={setAccount} />
        {account && (
          <span className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Users2 className="w-3.5 h-3.5" /> {account.name}
          </span>
        )}
      </div>

      {!account ? (
        <div className="text-center text-sm text-muted-foreground py-10 border border-dashed rounded-md">
          Selecione uma conta de anúncio pra montar o direcionamento.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Coluna esquerda: básico + busca */}
          <div className="space-y-4">
            <section className="rounded-lg border border-border bg-card p-4 space-y-3">
              <h4 className="text-sm font-semibold">Localização, idade e gênero</h4>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1.5">
                  <Label>País</Label>
                  <Input value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} maxLength={2} />
                </div>
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
                ) : results.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {query ? 'Nenhum resultado.' : 'Digite acima pra buscar.'}
                  </p>
                ) : (
                  results.map((item) => (
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

            <section className="rounded-lg border border-border bg-card p-4 space-y-2">
              <h4 className="text-sm font-semibold">Salvar como público reutilizável</h4>
              <div className="flex gap-2">
                <Input
                  value={audienceName}
                  onChange={(e) => setAudienceName(e.target.value)}
                  placeholder="Nome do público"
                />
                <Button onClick={handleSaveAudience} disabled={savingAudience}>
                  {savingAudience ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Fica disponível pra usar em qualquer campanha nova, direto no Gerenciador de Anúncios da Meta.
              </p>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
