import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button, Input } from '@evoapi/design-system';
import { Building2, Film, Image as ImageIcon, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { MetaScopedEntityPicker } from '@/components/marketing/MetaScopedEntityPicker';
import { useMetaAdAccountScope } from '@/components/marketing/metaAdAccountScope';
import { clientGoalsService } from '@/services/marketing/clientGoalsService';
import { metaCreationService, type AdCreativeImage, type AdCreativeVideo } from '@/services/marketing/metaCreationService';
import { apiErrorMessage } from '@/utils/apiHelpers';

// Biblioteca de criativos já existentes na conta de anúncio (/adimages e
// /advideos da Graph API) — pra reaproveitar em anúncios novos sem subir
// de novo. Listar e excluir já funcionam com o acesso atual do app
// (testado ao vivo); só subir uma imagem nova depende do Marketing API
// Access Tier estar em "Full access" (pedido em análise na Meta) — até
// aprovar, essa ação mostra a mensagem de erro real que a Graph API devolver.
export function CreativeLibraryTab() {
  const { account, setAccount, bm: selectedBm, setBm: setSelectedBm, pickerKey: pickerResetKey, resetPicker } = useMetaAdAccountScope();

  const [images, setImages] = useState<AdCreativeImage[] | null>(null);
  const [videos, setVideos] = useState<AdCreativeVideo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadUrl, setUploadUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback((accountId: string) => {
    setLoading(true);
    Promise.all([metaCreationService.listCreativeImages(accountId), metaCreationService.listCreativeVideos(accountId)])
      .then(([imgs, vids]) => {
        setImages(imgs);
        setVideos(vids);
      })
      .catch(() => toast.error('Erro ao carregar a biblioteca de criativos'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (account) load(account.id);
  }, [account, load]);

  const handleUpload = async () => {
    if (!account || !uploadUrl.trim()) return;
    setUploading(true);
    try {
      await metaCreationService.uploadCreativeImageByUrl(account.id, uploadUrl.trim());
      toast.success('Imagem adicionada à biblioteca!');
      setUploadUrl('');
      load(account.id);
    } catch (error) {
      toast.error(apiErrorMessage(error) || 'Erro ao subir a imagem.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (img: AdCreativeImage) => {
    if (!account || deletingId) return;
    const confirmed = window.confirm(`Excluir a imagem "${img.name || img.hash}"?\n\nIsso é definitivo: ela some da conta na Meta.`);
    if (!confirmed) return;
    setDeletingId(img.hash);
    try {
      await metaCreationService.deleteCreativeImage(account.id, img.hash);
      toast.success('Imagem excluída.');
      load(account.id);
    } catch (error) {
      toast.error(apiErrorMessage(error) || 'Erro ao excluir a imagem.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteVideo = async (video: AdCreativeVideo) => {
    if (!account || deletingId) return;
    const confirmed = window.confirm(`Excluir o vídeo "${video.title || video.id}"?\n\nIsso é definitivo: ele some da conta na Meta.`);
    if (!confirmed) return;
    setDeletingId(video.id);
    try {
      await metaCreationService.deleteCreativeVideo(video.id);
      toast.success('Vídeo excluído.');
      load(account.id);
    } catch (error) {
      toast.error(apiErrorMessage(error) || 'Erro ao excluir o vídeo.');
    } finally {
      setDeletingId(null);
    }
  };

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
        <>
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5 shrink-0">
              <Building2 className="w-3.5 h-3.5" />
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
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => load(account.id)} disabled={loading}>
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Atualizar
            </Button>
          </div>

          <section className="rounded-lg border border-border bg-card p-4 space-y-2">
            <h4 className="text-sm font-semibold">Adicionar imagem por URL</h4>
            <div className="flex gap-2">
              <Input
                value={uploadUrl}
                onChange={(e) => setUploadUrl(e.target.value)}
                placeholder="https://exemplo.com/imagem.jpg"
              />
              <Button onClick={handleUpload} disabled={uploading || !uploadUrl.trim()}>
                <Plus className="w-4 h-4 mr-1" /> {uploading ? 'Enviando...' : 'Adicionar'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              A Meta busca a imagem direto dessa URL e guarda na biblioteca da conta.
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4" /> Imagens ({images?.length ?? 0})
            </h4>
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
            ) : !images || images.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-md">
                Nenhuma imagem nesta conta.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {images.map((img) => (
                  <div key={img.hash} className="rounded-lg border border-border bg-card overflow-hidden">
                    <div className="aspect-square bg-muted">
                      <img src={img.url} alt={img.name || img.hash} className="w-full h-full object-cover" />
                    </div>
                    <div className="p-2 space-y-1.5">
                      <p className="text-xs truncate" title={img.name || img.hash}>
                        {img.name || img.hash}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-destructive hover:text-destructive"
                        disabled={deletingId === img.hash}
                        onClick={() => handleDeleteImage(img)}
                      >
                        <Trash2 className="w-3 h-3 mr-1" /> Excluir
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-1.5">
              <Film className="w-4 h-4" /> Vídeos ({videos?.length ?? 0})
            </h4>
            {!loading && (!videos || videos.length === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-md">
                Nenhum vídeo nesta conta.
              </p>
            ) : videos && videos.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {videos.map((video) => (
                  <div key={video.id} className="rounded-lg border border-border bg-card overflow-hidden">
                    <div className="aspect-square bg-muted flex items-center justify-center">
                      {video.picture ? (
                        <img src={video.picture} alt={video.title || video.id} className="w-full h-full object-cover" />
                      ) : (
                        <Film className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="p-2 space-y-1.5">
                      <p className="text-xs truncate" title={video.title || video.id}>
                        {video.title || video.id}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-destructive hover:text-destructive"
                        disabled={deletingId === video.id}
                        onClick={() => handleDeleteVideo(video)}
                      >
                        <Trash2 className="w-3 h-3 mr-1" /> Excluir
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
