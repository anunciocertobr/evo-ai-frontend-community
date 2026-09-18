import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button, Badge, Tabs, TabsContent, TabsList, TabsTrigger } from '@evoapi/design-system';
import { Plus, Users, KeyRound, Type, Pencil, Trash2 } from 'lucide-react';
import { BaseHeader } from '@/components/base';
import { GoogleAdsAudienceDialog } from '@/components/marketing/GoogleAdsAudienceDialog';
import { GoogleAdsKeywordGroupDialog } from '@/components/marketing/GoogleAdsKeywordGroupDialog';
import { GoogleAdsHeadlineSetDialog } from '@/components/marketing/GoogleAdsHeadlineSetDialog';
import {
  googleAdsCreationService,
  type AudiencePayload,
  type KeywordGroupPayload,
  type HeadlineSetPayload,
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

  useEffect(() => {
    loadAudiences();
    loadKeywordGroups();
    loadHeadlineSets();
  }, [loadAudiences, loadKeywordGroups, loadHeadlineSets]);

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
        <TabsList className="mb-4">
          <TabsTrigger value="audiences">
            <Users className="w-4 h-4 mr-1.5" /> Públicos Personalizados
          </TabsTrigger>
          <TabsTrigger value="keywords">
            <KeyRound className="w-4 h-4 mr-1.5" /> Palavras-chave
          </TabsTrigger>
          <TabsTrigger value="headlines">
            <Type className="w-4 h-4 mr-1.5" /> Títulos e Descrições
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
      </Tabs>
    </div>
  );
}
