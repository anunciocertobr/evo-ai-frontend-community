import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button, Badge, Tabs, TabsContent, TabsList, TabsTrigger } from '@evoapi/design-system';
import { Plus, Users, KeyRound, Type, Pencil, Trash2, Link2, MessageSquareQuote, List, Phone, ClipboardList, Tag, Image as ImageIcon } from 'lucide-react';
import { BaseHeader } from '@/components/base';
import { GoogleAdsAudienceDialog } from '@/components/marketing/GoogleAdsAudienceDialog';
import { GoogleAdsKeywordGroupDialog } from '@/components/marketing/GoogleAdsKeywordGroupDialog';
import { GoogleAdsHeadlineSetDialog } from '@/components/marketing/GoogleAdsHeadlineSetDialog';
import { GoogleAdsSitelinkDialog } from '@/components/marketing/GoogleAdsSitelinkDialog';
import { GoogleAdsCalloutDialog } from '@/components/marketing/GoogleAdsCalloutDialog';
import { GoogleAdsStructuredSnippetDialog } from '@/components/marketing/GoogleAdsStructuredSnippetDialog';
import { GoogleAdsCallDialog } from '@/components/marketing/GoogleAdsCallDialog';
import { GoogleAdsLeadFormDialog } from '@/components/marketing/GoogleAdsLeadFormDialog';
import { GoogleAdsPriceDialog } from '@/components/marketing/GoogleAdsPriceDialog';
import { GoogleAdsImageAssetDialog } from '@/components/marketing/GoogleAdsImageAssetDialog';
import {
  googleAdsCreationService,
  type AudiencePayload,
  type KeywordGroupPayload,
  type HeadlineSetPayload,
  type SitelinkPayload,
  type CalloutPayload,
  type StructuredSnippetPayload,
  type CallPayload,
  type LeadFormPayload,
  type PricePayload,
  type ImageAssetPayload,
  type GoogleAdsAsset,
} from '@/services/marketing/googleAdsCreationService';

function EmptyState({ label }: { label: string }) {
  return (
    <div className="text-center text-sm text-muted-foreground py-10 border border-dashed rounded-md">{label}</div>
  );
}

function AssetActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex gap-1.5 pt-1">
      <Button size="sm" variant="outline" onClick={onEdit}>
        <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
      </Button>
      <Button size="sm" variant="outline" onClick={onDelete}>
        <Trash2 className="w-3.5 h-3.5 mr-1 text-rose-500" /> Excluir
      </Button>
    </div>
  );
}

export default function GoogleAdsCreationPage() {
  // Públicos personalizados
  const [audiences, setAudiences] = useState<GoogleAdsAsset<AudiencePayload>[] | null>(null);
  const [loadingAudiences, setLoadingAudiences] = useState(false);
  const [audienceDialogOpen, setAudienceDialogOpen] = useState(false);
  const [editingAudience, setEditingAudience] = useState<GoogleAdsAsset<AudiencePayload> | null>(null);

  // Palavras-chave
  const [keywordGroups, setKeywordGroups] = useState<GoogleAdsAsset<KeywordGroupPayload>[] | null>(null);
  const [loadingKeywordGroups, setLoadingKeywordGroups] = useState(false);
  const [keywordDialogOpen, setKeywordDialogOpen] = useState(false);
  const [editingKeywordGroup, setEditingKeywordGroup] = useState<GoogleAdsAsset<KeywordGroupPayload> | null>(null);

  // Títulos e descrições
  const [headlineSets, setHeadlineSets] = useState<GoogleAdsAsset<HeadlineSetPayload>[] | null>(null);
  const [loadingHeadlineSets, setLoadingHeadlineSets] = useState(false);
  const [headlineDialogOpen, setHeadlineDialogOpen] = useState(false);
  const [editingHeadlineSet, setEditingHeadlineSet] = useState<GoogleAdsAsset<HeadlineSetPayload> | null>(null);

  // Sitelinks
  const [sitelinkSets, setSitelinkSets] = useState<GoogleAdsAsset<SitelinkPayload>[] | null>(null);
  const [loadingSitelinkSets, setLoadingSitelinkSets] = useState(false);
  const [sitelinkDialogOpen, setSitelinkDialogOpen] = useState(false);
  const [editingSitelinkSet, setEditingSitelinkSet] = useState<GoogleAdsAsset<SitelinkPayload> | null>(null);

  // Frases de destaque (callouts)
  const [calloutSets, setCalloutSets] = useState<GoogleAdsAsset<CalloutPayload>[] | null>(null);
  const [loadingCalloutSets, setLoadingCalloutSets] = useState(false);
  const [calloutDialogOpen, setCalloutDialogOpen] = useState(false);
  const [editingCalloutSet, setEditingCalloutSet] = useState<GoogleAdsAsset<CalloutPayload> | null>(null);

  // Snippets estruturados
  const [snippetSets, setSnippetSets] = useState<GoogleAdsAsset<StructuredSnippetPayload>[] | null>(null);
  const [loadingSnippetSets, setLoadingSnippetSets] = useState(false);
  const [snippetDialogOpen, setSnippetDialogOpen] = useState(false);
  const [editingSnippetSet, setEditingSnippetSet] = useState<GoogleAdsAsset<StructuredSnippetPayload> | null>(null);

  // Extensão de chamada
  const [callSets, setCallSets] = useState<GoogleAdsAsset<CallPayload>[] | null>(null);
  const [loadingCallSets, setLoadingCallSets] = useState(false);
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [editingCallSet, setEditingCallSet] = useState<GoogleAdsAsset<CallPayload> | null>(null);

  // Formulário de lead
  const [leadFormSets, setLeadFormSets] = useState<GoogleAdsAsset<LeadFormPayload>[] | null>(null);
  const [loadingLeadFormSets, setLoadingLeadFormSets] = useState(false);
  const [leadFormDialogOpen, setLeadFormDialogOpen] = useState(false);
  const [editingLeadFormSet, setEditingLeadFormSet] = useState<GoogleAdsAsset<LeadFormPayload> | null>(null);

  // Extensão de preço
  const [priceSets, setPriceSets] = useState<GoogleAdsAsset<PricePayload>[] | null>(null);
  const [loadingPriceSets, setLoadingPriceSets] = useState(false);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [editingPriceSet, setEditingPriceSet] = useState<GoogleAdsAsset<PricePayload> | null>(null);

  // Imagens (Image Assets)
  const [imageSets, setImageSets] = useState<GoogleAdsAsset<ImageAssetPayload>[] | null>(null);
  const [loadingImageSets, setLoadingImageSets] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [editingImageSet, setEditingImageSet] = useState<GoogleAdsAsset<ImageAssetPayload> | null>(null);

  const loadAudiences = useCallback(() => {
    setLoadingAudiences(true);
    googleAdsCreationService
      .list<AudiencePayload>('audience')
      .then(setAudiences)
      .catch(() => toast.error('Erro ao carregar públicos'))
      .finally(() => setLoadingAudiences(false));
  }, []);

  const loadKeywordGroups = useCallback(() => {
    setLoadingKeywordGroups(true);
    googleAdsCreationService
      .list<KeywordGroupPayload>('keyword_group')
      .then(setKeywordGroups)
      .catch(() => toast.error('Erro ao carregar grupos de palavras-chave'))
      .finally(() => setLoadingKeywordGroups(false));
  }, []);

  const loadHeadlineSets = useCallback(() => {
    setLoadingHeadlineSets(true);
    googleAdsCreationService
      .list<HeadlineSetPayload>('headline_set')
      .then(setHeadlineSets)
      .catch(() => toast.error('Erro ao carregar títulos e descrições'))
      .finally(() => setLoadingHeadlineSets(false));
  }, []);

  const loadSitelinkSets = useCallback(() => {
    setLoadingSitelinkSets(true);
    googleAdsCreationService
      .list<SitelinkPayload>('sitelink')
      .then(setSitelinkSets)
      .catch(() => toast.error('Erro ao carregar sitelinks'))
      .finally(() => setLoadingSitelinkSets(false));
  }, []);

  const loadCalloutSets = useCallback(() => {
    setLoadingCalloutSets(true);
    googleAdsCreationService
      .list<CalloutPayload>('callout')
      .then(setCalloutSets)
      .catch(() => toast.error('Erro ao carregar frases de destaque'))
      .finally(() => setLoadingCalloutSets(false));
  }, []);

  const loadSnippetSets = useCallback(() => {
    setLoadingSnippetSets(true);
    googleAdsCreationService
      .list<StructuredSnippetPayload>('structured_snippet')
      .then(setSnippetSets)
      .catch(() => toast.error('Erro ao carregar snippets estruturados'))
      .finally(() => setLoadingSnippetSets(false));
  }, []);

  const loadCallSets = useCallback(() => {
    setLoadingCallSets(true);
    googleAdsCreationService
      .list<CallPayload>('call')
      .then(setCallSets)
      .catch(() => toast.error('Erro ao carregar extensões de chamada'))
      .finally(() => setLoadingCallSets(false));
  }, []);

  const loadLeadFormSets = useCallback(() => {
    setLoadingLeadFormSets(true);
    googleAdsCreationService
      .list<LeadFormPayload>('lead_form')
      .then(setLeadFormSets)
      .catch(() => toast.error('Erro ao carregar formulários de lead'))
      .finally(() => setLoadingLeadFormSets(false));
  }, []);

  const loadPriceSets = useCallback(() => {
    setLoadingPriceSets(true);
    googleAdsCreationService
      .list<PricePayload>('price')
      .then(setPriceSets)
      .catch(() => toast.error('Erro ao carregar extensões de preço'))
      .finally(() => setLoadingPriceSets(false));
  }, []);

  const loadImageSets = useCallback(() => {
    setLoadingImageSets(true);
    googleAdsCreationService
      .list<ImageAssetPayload>('image_asset')
      .then(setImageSets)
      .catch(() => toast.error('Erro ao carregar imagens'))
      .finally(() => setLoadingImageSets(false));
  }, []);

  useEffect(() => {
    loadAudiences();
    loadKeywordGroups();
    loadHeadlineSets();
    loadSitelinkSets();
    loadCalloutSets();
    loadSnippetSets();
    loadCallSets();
    loadLeadFormSets();
    loadPriceSets();
    loadImageSets();
  }, [
    loadAudiences,
    loadKeywordGroups,
    loadHeadlineSets,
    loadSitelinkSets,
    loadCalloutSets,
    loadSnippetSets,
    loadCallSets,
    loadLeadFormSets,
    loadPriceSets,
    loadImageSets,
  ]);

  const deleteAsset = async (id: string, reload: () => void, label: string) => {
    if (!window.confirm(`Excluir "${label}"? Essa ação não pode ser desfeita.`)) return;
    try {
      await googleAdsCreationService.remove(id);
      toast.success('Excluído');
      reload();
    } catch {
      toast.error('Erro ao excluir');
    }
  };

  return (
    <div className="space-y-4 pb-8">
      <BaseHeader
        title="Criação Google Ads"
        subtitle="Monte públicos, palavras-chave e títulos/descrições — sem conta do Google Ads conectada ainda, fica salvo aqui pra publicar assim que a integração estiver pronta."
      />

      <Tabs defaultValue="audiences">
        <TabsList className="mb-4 h-auto w-full flex-nowrap justify-start gap-2 overflow-x-auto">
          <TabsTrigger value="audiences">
            <Users className="w-4 h-4 mr-1.5" /> Públicos Personalizados
          </TabsTrigger>
          <TabsTrigger value="keywords">
            <KeyRound className="w-4 h-4 mr-1.5" /> Palavras-chave
          </TabsTrigger>
          <TabsTrigger value="headlines">
            <Type className="w-4 h-4 mr-1.5" /> Títulos e Descrições
          </TabsTrigger>
          <TabsTrigger value="sitelinks">
            <Link2 className="w-4 h-4 mr-1.5" /> Sitelinks
          </TabsTrigger>
          <TabsTrigger value="callouts">
            <MessageSquareQuote className="w-4 h-4 mr-1.5" /> Frases de Destaque
          </TabsTrigger>
          <TabsTrigger value="snippets">
            <List className="w-4 h-4 mr-1.5" /> Snippets Estruturados
          </TabsTrigger>
          <TabsTrigger value="calls">
            <Phone className="w-4 h-4 mr-1.5" /> Chamada
          </TabsTrigger>
          <TabsTrigger value="leadforms">
            <ClipboardList className="w-4 h-4 mr-1.5" /> Formulário de Lead
          </TabsTrigger>
          <TabsTrigger value="prices">
            <Tag className="w-4 h-4 mr-1.5" /> Preço
          </TabsTrigger>
          <TabsTrigger value="images">
            <ImageIcon className="w-4 h-4 mr-1.5" /> Imagens
          </TabsTrigger>
        </TabsList>

        {/* --- Públicos Personalizados --- */}
        <TabsContent value="audiences" className="space-y-4">
          <div className="flex items-center justify-end">
            <Button
              onClick={() => {
                setEditingAudience(null);
                setAudienceDialogOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1.5" /> Novo público
            </Button>
          </div>

          {loadingAudiences ? (
            <div className="text-center text-sm text-muted-foreground py-10">Carregando...</div>
          ) : !audiences || audiences.length === 0 ? (
            <EmptyState label="Nenhum público personalizado criado ainda." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {audiences.map((a) => (
                <div key={a.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                  <h4 className="text-sm font-semibold truncate" title={a.name}>
                    {a.name}
                  </h4>
                  {a.payload.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{a.payload.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {a.payload.keywords.slice(0, 3).map((k) => (
                      <Badge key={k} variant="outline" className="text-[10px]">
                        {k}
                      </Badge>
                    ))}
                    {a.payload.keywords.length + a.payload.urls.length + a.payload.apps.length > 3 && (
                      <Badge variant="outline" className="text-[10px]">
                        +{a.payload.keywords.length + a.payload.urls.length + a.payload.apps.length - 3}
                      </Badge>
                    )}
                  </div>
                  <AssetActions
                    onEdit={() => {
                      setEditingAudience(a);
                      setAudienceDialogOpen(true);
                    }}
                    onDelete={() => deleteAsset(a.id, loadAudiences, a.name)}
                  />
                </div>
              ))}
            </div>
          )}

          <GoogleAdsAudienceDialog
            open={audienceDialogOpen}
            onOpenChange={setAudienceDialogOpen}
            onSaved={loadAudiences}
            editing={editingAudience}
          />
        </TabsContent>

        {/* --- Palavras-chave --- */}
        <TabsContent value="keywords" className="space-y-4">
          <div className="flex items-center justify-end">
            <Button
              onClick={() => {
                setEditingKeywordGroup(null);
                setKeywordDialogOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1.5" /> Novo grupo
            </Button>
          </div>

          {loadingKeywordGroups ? (
            <div className="text-center text-sm text-muted-foreground py-10">Carregando...</div>
          ) : !keywordGroups || keywordGroups.length === 0 ? (
            <EmptyState label="Nenhum grupo de palavras-chave criado ainda." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {keywordGroups.map((kg) => {
                const positive = kg.payload.keywords.filter((k) => !k.negative).length;
                const negative = kg.payload.keywords.filter((k) => k.negative).length;
                return (
                  <div key={kg.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                    <h4 className="text-sm font-semibold truncate" title={kg.name}>
                      {kg.name}
                    </h4>
                    {kg.payload.adGroupName && (
                      <p className="text-xs text-muted-foreground">Grupo de anúncios: {kg.payload.adGroupName}</p>
                    )}
                    <p className="text-xs">
                      <span className="font-medium">{positive}</span> palavra(s){' '}
                      {negative > 0 && (
                        <span className="text-rose-500">· {negative} negativa(s)</span>
                      )}
                    </p>
                    <AssetActions
                      onEdit={() => {
                        setEditingKeywordGroup(kg);
                        setKeywordDialogOpen(true);
                      }}
                      onDelete={() => deleteAsset(kg.id, loadKeywordGroups, kg.name)}
                    />
                  </div>
                );
              })}
            </div>
          )}

          <GoogleAdsKeywordGroupDialog
            open={keywordDialogOpen}
            onOpenChange={setKeywordDialogOpen}
            onSaved={loadKeywordGroups}
            editing={editingKeywordGroup}
          />
        </TabsContent>

        {/* --- Títulos e Descrições --- */}
        <TabsContent value="headlines" className="space-y-4">
          <div className="flex items-center justify-end">
            <Button
              onClick={() => {
                setEditingHeadlineSet(null);
                setHeadlineDialogOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1.5" /> Novo conjunto
            </Button>
          </div>

          {loadingHeadlineSets ? (
            <div className="text-center text-sm text-muted-foreground py-10">Carregando...</div>
          ) : !headlineSets || headlineSets.length === 0 ? (
            <EmptyState label="Nenhum conjunto de títulos/descrições criado ainda." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {headlineSets.map((hs) => (
                <div key={hs.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                  <h4 className="text-sm font-semibold truncate" title={hs.name}>
                    {hs.name}
                  </h4>
                  <p className="text-xs text-muted-foreground truncate">
                    {hs.payload.headlines[0] || 'Sem título'}
                  </p>
                  <p className="text-xs">
                    <span className="font-medium">{hs.payload.headlines.length}</span> títulos ·{' '}
                    <span className="font-medium">{hs.payload.descriptions.length}</span> descrições
                  </p>
                  <AssetActions
                    onEdit={() => {
                      setEditingHeadlineSet(hs);
                      setHeadlineDialogOpen(true);
                    }}
                    onDelete={() => deleteAsset(hs.id, loadHeadlineSets, hs.name)}
                  />
                </div>
              ))}
            </div>
          )}

          <GoogleAdsHeadlineSetDialog
            open={headlineDialogOpen}
            onOpenChange={setHeadlineDialogOpen}
            onSaved={loadHeadlineSets}
            editing={editingHeadlineSet}
          />
        </TabsContent>

        {/* --- Sitelinks --- */}
        <TabsContent value="sitelinks" className="space-y-4">
          <div className="flex items-center justify-end">
            <Button
              onClick={() => {
                setEditingSitelinkSet(null);
                setSitelinkDialogOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1.5" /> Novo conjunto
            </Button>
          </div>

          {loadingSitelinkSets ? (
            <div className="text-center text-sm text-muted-foreground py-10">Carregando...</div>
          ) : !sitelinkSets || sitelinkSets.length === 0 ? (
            <EmptyState label="Nenhum conjunto de sitelinks criado ainda." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sitelinkSets.map((s) => (
                <div key={s.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                  <h4 className="text-sm font-semibold truncate" title={s.name}>
                    {s.name}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">{s.payload.sitelinks.length}</span> sitelink(s)
                  </p>
                  <AssetActions
                    onEdit={() => {
                      setEditingSitelinkSet(s);
                      setSitelinkDialogOpen(true);
                    }}
                    onDelete={() => deleteAsset(s.id, loadSitelinkSets, s.name)}
                  />
                </div>
              ))}
            </div>
          )}

          <GoogleAdsSitelinkDialog
            open={sitelinkDialogOpen}
            onOpenChange={setSitelinkDialogOpen}
            onSaved={loadSitelinkSets}
            editing={editingSitelinkSet}
          />
        </TabsContent>

        {/* --- Frases de destaque (callouts) --- */}
        <TabsContent value="callouts" className="space-y-4">
          <div className="flex items-center justify-end">
            <Button
              onClick={() => {
                setEditingCalloutSet(null);
                setCalloutDialogOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1.5" /> Novo conjunto
            </Button>
          </div>

          {loadingCalloutSets ? (
            <div className="text-center text-sm text-muted-foreground py-10">Carregando...</div>
          ) : !calloutSets || calloutSets.length === 0 ? (
            <EmptyState label="Nenhuma frase de destaque criada ainda." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {calloutSets.map((c) => (
                <div key={c.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                  <h4 className="text-sm font-semibold truncate" title={c.name}>
                    {c.name}
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {c.payload.callouts.slice(0, 4).map((text) => (
                      <Badge key={text} variant="outline" className="text-[10px]">
                        {text}
                      </Badge>
                    ))}
                    {c.payload.callouts.length > 4 && (
                      <Badge variant="outline" className="text-[10px]">
                        +{c.payload.callouts.length - 4}
                      </Badge>
                    )}
                  </div>
                  <AssetActions
                    onEdit={() => {
                      setEditingCalloutSet(c);
                      setCalloutDialogOpen(true);
                    }}
                    onDelete={() => deleteAsset(c.id, loadCalloutSets, c.name)}
                  />
                </div>
              ))}
            </div>
          )}

          <GoogleAdsCalloutDialog
            open={calloutDialogOpen}
            onOpenChange={setCalloutDialogOpen}
            onSaved={loadCalloutSets}
            editing={editingCalloutSet}
          />
        </TabsContent>

        {/* --- Snippets estruturados --- */}
        <TabsContent value="snippets" className="space-y-4">
          <div className="flex items-center justify-end">
            <Button
              onClick={() => {
                setEditingSnippetSet(null);
                setSnippetDialogOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1.5" /> Novo snippet
            </Button>
          </div>

          {loadingSnippetSets ? (
            <div className="text-center text-sm text-muted-foreground py-10">Carregando...</div>
          ) : !snippetSets || snippetSets.length === 0 ? (
            <EmptyState label="Nenhum snippet estruturado criado ainda." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {snippetSets.map((s) => (
                <div key={s.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                  <h4 className="text-sm font-semibold truncate" title={s.name}>
                    {s.name}
                  </h4>
                  <p className="text-xs text-muted-foreground truncate">
                    {s.payload.values.slice(0, 3).join(', ')}
                    {s.payload.values.length > 3 ? '…' : ''}
                  </p>
                  <AssetActions
                    onEdit={() => {
                      setEditingSnippetSet(s);
                      setSnippetDialogOpen(true);
                    }}
                    onDelete={() => deleteAsset(s.id, loadSnippetSets, s.name)}
                  />
                </div>
              ))}
            </div>
          )}

          <GoogleAdsStructuredSnippetDialog
            open={snippetDialogOpen}
            onOpenChange={setSnippetDialogOpen}
            onSaved={loadSnippetSets}
            editing={editingSnippetSet}
          />
        </TabsContent>

        {/* --- Extensão de chamada --- */}
        <TabsContent value="calls" className="space-y-4">
          <div className="flex items-center justify-end">
            <Button
              onClick={() => {
                setEditingCallSet(null);
                setCallDialogOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1.5" /> Nova extensão
            </Button>
          </div>

          {loadingCallSets ? (
            <div className="text-center text-sm text-muted-foreground py-10">Carregando...</div>
          ) : !callSets || callSets.length === 0 ? (
            <EmptyState label="Nenhuma extensão de chamada criada ainda." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {callSets.map((c) => (
                <div key={c.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                  <h4 className="text-sm font-semibold truncate" title={c.name}>
                    {c.name}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    +{c.payload.countryCode} {c.payload.phoneNumber}
                  </p>
                  <AssetActions
                    onEdit={() => {
                      setEditingCallSet(c);
                      setCallDialogOpen(true);
                    }}
                    onDelete={() => deleteAsset(c.id, loadCallSets, c.name)}
                  />
                </div>
              ))}
            </div>
          )}

          <GoogleAdsCallDialog
            open={callDialogOpen}
            onOpenChange={setCallDialogOpen}
            onSaved={loadCallSets}
            editing={editingCallSet}
          />
        </TabsContent>

        {/* --- Formulário de lead --- */}
        <TabsContent value="leadforms" className="space-y-4">
          <div className="flex items-center justify-end">
            <Button
              onClick={() => {
                setEditingLeadFormSet(null);
                setLeadFormDialogOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1.5" /> Novo formulário
            </Button>
          </div>

          {loadingLeadFormSets ? (
            <div className="text-center text-sm text-muted-foreground py-10">Carregando...</div>
          ) : !leadFormSets || leadFormSets.length === 0 ? (
            <EmptyState label="Nenhum formulário de lead criado ainda." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {leadFormSets.map((lf) => (
                <div key={lf.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                  <h4 className="text-sm font-semibold truncate" title={lf.name}>
                    {lf.name}
                  </h4>
                  <p className="text-xs text-muted-foreground truncate">{lf.payload.headline}</p>
                  <p className="text-xs">
                    <span className="font-medium">{lf.payload.questions.length}</span> pergunta(s)
                  </p>
                  <AssetActions
                    onEdit={() => {
                      setEditingLeadFormSet(lf);
                      setLeadFormDialogOpen(true);
                    }}
                    onDelete={() => deleteAsset(lf.id, loadLeadFormSets, lf.name)}
                  />
                </div>
              ))}
            </div>
          )}

          <GoogleAdsLeadFormDialog
            open={leadFormDialogOpen}
            onOpenChange={setLeadFormDialogOpen}
            onSaved={loadLeadFormSets}
            editing={editingLeadFormSet}
          />
        </TabsContent>

        {/* --- Extensão de preço --- */}
        <TabsContent value="prices" className="space-y-4">
          <div className="flex items-center justify-end">
            <Button
              onClick={() => {
                setEditingPriceSet(null);
                setPriceDialogOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1.5" /> Nova extensão
            </Button>
          </div>

          {loadingPriceSets ? (
            <div className="text-center text-sm text-muted-foreground py-10">Carregando...</div>
          ) : !priceSets || priceSets.length === 0 ? (
            <EmptyState label="Nenhuma extensão de preço criada ainda." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {priceSets.map((p) => (
                <div key={p.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                  <h4 className="text-sm font-semibold truncate" title={p.name}>
                    {p.name}
                  </h4>
                  <p className="text-xs">
                    <span className="font-medium">{p.payload.offerings.length}</span> item(ns)
                  </p>
                  <AssetActions
                    onEdit={() => {
                      setEditingPriceSet(p);
                      setPriceDialogOpen(true);
                    }}
                    onDelete={() => deleteAsset(p.id, loadPriceSets, p.name)}
                  />
                </div>
              ))}
            </div>
          )}

          <GoogleAdsPriceDialog
            open={priceDialogOpen}
            onOpenChange={setPriceDialogOpen}
            onSaved={loadPriceSets}
            editing={editingPriceSet}
          />
        </TabsContent>

        {/* --- Imagens --- */}
        <TabsContent value="images" className="space-y-4">
          <div className="flex items-center justify-end">
            <Button
              onClick={() => {
                setEditingImageSet(null);
                setImageDialogOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1.5" /> Novo conjunto
            </Button>
          </div>

          {loadingImageSets ? (
            <div className="text-center text-sm text-muted-foreground py-10">Carregando...</div>
          ) : !imageSets || imageSets.length === 0 ? (
            <EmptyState label="Nenhuma imagem enviada ainda." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {imageSets.map((img) => (
                <div key={img.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                  <h4 className="text-sm font-semibold truncate" title={img.name}>
                    {img.name}
                  </h4>
                  <div className="flex gap-1.5 overflow-x-auto">
                    {img.payload.images.slice(0, 4).map((i) => (
                      <img key={i.fileUrl} src={i.fileUrl} alt={i.fileName} className="w-10 h-10 object-cover rounded border border-border shrink-0" />
                    ))}
                    {img.payload.images.length > 4 && (
                      <span className="text-xs text-muted-foreground self-center">+{img.payload.images.length - 4}</span>
                    )}
                  </div>
                  <AssetActions
                    onEdit={() => {
                      setEditingImageSet(img);
                      setImageDialogOpen(true);
                    }}
                    onDelete={() => deleteAsset(img.id, loadImageSets, img.name)}
                  />
                </div>
              ))}
            </div>
          )}

          <GoogleAdsImageAssetDialog
            open={imageDialogOpen}
            onOpenChange={setImageDialogOpen}
            onSaved={loadImageSets}
            editing={editingImageSet}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
