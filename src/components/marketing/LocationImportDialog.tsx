import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@evoapi/design-system';
import { trafficPanelService } from '@/services/marketing/trafficPanelService';
import { metaCreationService, type LocationGroup, type LocationGroupPin, type SavedAudience } from '@/services/marketing/metaCreationService';
import { pinsFromTargeting, type ImportedLocations } from '@/utils/marketing/locationImport';
import type { StructuralAdSet, StructuralCampaign } from '@/utils/marketing/trafficMetrics';
import { apiErrorMessage } from '@/utils/apiHelpers';

type Source = 'groups' | 'audiences' | 'campaigns';

const SOURCES: Array<{ id: Source; label: string }> = [
  { id: 'groups', label: 'Grupo salvo' },
  { id: 'audiences', label: 'Público salvo' },
  { id: 'campaigns', label: 'Campanha' },
];

// Puxa localizações de outro lugar pra dentro do grupo que está sendo editado:
// um grupo já salvo, um público salvo da conta, ou o conjunto de uma campanha.
// Antes de adicionar, mostra o que foi encontrado e o que ficou de fora.
export function LocationImportDialog({
  open,
  onOpenChange,
  accountId,
  groups,
  currentGroupId,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  groups: LocationGroup[];
  currentGroupId?: string;
  onImport: (pins: LocationGroupPin[]) => void;
}) {
  const [source, setSource] = useState<Source>('groups');
  const [audiences, setAudiences] = useState<SavedAudience[] | null>(null);
  const [campaigns, setCampaigns] = useState<StructuralCampaign[] | null>(null);
  const [campaign, setCampaign] = useState<StructuralCampaign | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [preview, setPreview] = useState<{ title: string; result: ImportedLocations } | null>(null);

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setCampaign(null);
      setProgress('');
      return;
    }
    setSource('groups');
  }, [open]);

  useEffect(() => {
    if (!open || !accountId) return;
    if (source === 'audiences' && audiences === null) {
      setLoading(true);
      metaCreationService
        .listSavedAudiences(accountId)
        .then(setAudiences)
        .catch((error) => toast.error(apiErrorMessage(error, true) || 'Erro ao carregar públicos salvos.'))
        .finally(() => setLoading(false));
    }
    if (source === 'campaigns' && campaigns === null) {
      setLoading(true);
      const hoje = new Date().toISOString().slice(0, 10);
      trafficPanelService
        .getCampaignsTree(accountId, '2020-01-01', hoje)
        .then((tree) => setCampaigns(tree.structural))
        .catch((error) => toast.error(apiErrorMessage(error, true) || 'Erro ao carregar campanhas.'))
        .finally(() => setLoading(false));
    }
  }, [open, source, accountId, audiences, campaigns]);

  const runPreview = async (title: string, targeting: Parameters<typeof pinsFromTargeting>[0]) => {
    setLoading(true);
    setProgress('Lendo a localização...');
    try {
      const result = await pinsFromTargeting(targeting, (done, total) => {
        if (total > 0) setProgress(`Localizando cidades: ${done}/${total}`);
      });
      setPreview({ title, result });
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const otherGroups = groups.filter((g) => g.id !== currentGroupId);
  const adsets: StructuralAdSet[] = campaign?.adsets?.data || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 text-slate-200 sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar localizações</DialogTitle>
          <DialogDescription className="text-slate-400">
            Puxe regiões e raios de um grupo salvo, de um público salvo ou do conjunto de uma campanha.
          </DialogDescription>
        </DialogHeader>

        {!preview && (
          <div className="flex gap-2">
            {SOURCES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSource(s.id);
                  setCampaign(null);
                }}
                className={`flex-1 text-xs px-3 py-1.5 rounded-md border ${
                  source === s.id ? 'bg-sky-900/40 border-sky-600 text-sky-300' : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {preview ? (
          <div className="space-y-3">
            <p className="text-sm">
              <span className="font-semibold">{preview.title}</span>: {preview.result.pins.length} localização(ões) encontrada(s).
            </p>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {preview.result.pins.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-xs p-2 rounded border border-slate-700 bg-slate-900/40">
                  <span className="truncate">{p.name}</span>
                  <span className="shrink-0 text-slate-400 ml-2">
                    {p.exclude ? <span className="text-red-300">excluir · </span> : null}
                    {p.radius} km
                  </span>
                </div>
              ))}
            </div>
            {preview.result.skipped.length > 0 && (
              <div className="text-xs text-amber-300/90 space-y-1">
                <p className="font-medium">Não importado ({preview.result.skipped.length}):</p>
                {preview.result.skipped.map((s, i) => (
                  <p key={i}>{s}</p>
                ))}
              </div>
            )}
          </div>
        ) : loading ? (
          <p className="text-sm text-slate-400 py-6 text-center">{progress || 'Carregando...'}</p>
        ) : source === 'groups' ? (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {otherGroups.length === 0 && <p className="text-sm text-slate-400 py-6 text-center">Nenhum outro grupo salvo nesta conta.</p>}
            {otherGroups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  onImport(g.pins);
                  onOpenChange(false);
                }}
                className="w-full text-left p-3 rounded-md border border-slate-700 bg-slate-900/40 hover:border-sky-600"
              >
                <span className="text-sm font-medium">{g.name}</span>
                <span className="text-xs text-slate-400 ml-2">({g.pins.length} localização(ões))</span>
              </button>
            ))}
          </div>
        ) : source === 'audiences' ? (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {(audiences || []).length === 0 && <p className="text-sm text-slate-400 py-6 text-center">Nenhum público salvo nesta conta.</p>}
            {(audiences || []).map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => runPreview(a.name, a.targeting as Parameters<typeof pinsFromTargeting>[0])}
                className="w-full text-left p-3 rounded-md border border-slate-700 bg-slate-900/40 hover:border-sky-600 text-sm"
              >
                {a.name}
              </button>
            ))}
          </div>
        ) : campaign === null ? (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {(campaigns || []).length === 0 && <p className="text-sm text-slate-400 py-6 text-center">Nenhuma campanha nesta conta.</p>}
            {(campaigns || []).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCampaign(c)}
                className="w-full text-left p-3 rounded-md border border-slate-700 bg-slate-900/40 hover:border-sky-600 text-sm"
              >
                {c.name}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            <button type="button" onClick={() => setCampaign(null)} className="text-xs text-sky-400 underline">
              ← Campanhas
            </button>
            <p className="text-xs text-slate-400">Escolha o conjunto de anúncios de "{campaign.name}":</p>
            {adsets.length === 0 && <p className="text-sm text-slate-400 py-4 text-center">Esta campanha não tem conjuntos.</p>}
            {adsets.map((ad) => (
              <button
                key={ad.id}
                type="button"
                onClick={() => runPreview(`${campaign.name} › ${ad.name}`, ad.targeting as Parameters<typeof pinsFromTargeting>[0])}
                className="w-full text-left p-3 rounded-md border border-slate-700 bg-slate-900/40 hover:border-sky-600 text-sm"
              >
                {ad.name}
              </button>
            ))}
          </div>
        )}

        <DialogFooter>
          {preview ? (
            <>
              <Button variant="outline" onClick={() => setPreview(null)} className="border-slate-600 text-slate-300">
                Voltar
              </Button>
              <Button
                disabled={preview.result.pins.length === 0}
                onClick={() => {
                  onImport(preview.result.pins);
                  onOpenChange(false);
                }}
              >
                Adicionar {preview.result.pins.length} ao grupo
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-600 text-slate-300">
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
