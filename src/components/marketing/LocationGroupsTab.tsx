import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@evoapi/design-system';
import { Building2, Copy, Import, ListChecks, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { MetaScopedEntityPicker } from '@/components/marketing/MetaScopedEntityPicker';
import { useMetaAdAccountScope } from '@/components/marketing/metaAdAccountScope';
import { LocationMapPicker, type LocationEntry } from '@/components/marketing/LocationMapPicker';
import { LocationImportDialog } from '@/components/marketing/LocationImportDialog';
import { clientGoalsService } from '@/services/marketing/clientGoalsService';
import { metaCreationService, type LocationGroup, type LocationGroupPin } from '@/services/marketing/metaCreationService';
import { pinsFromOrigin } from '@/utils/marketing/geoResolve';
import { apiErrorMessage } from '@/utils/apiHelpers';

function pinsToLocations(pins: LocationGroupPin[], exclude = false): LocationEntry[] {
  return pins
    .filter((p) => Boolean(p.exclude) === exclude)
    .map((p) => ({ id: crypto.randomUUID(), name: p.name, lat: p.lat, lng: p.lng, radius: p.radius }));
}

// Junta sem repetir: mesmo ponto (coordenada e raio) não entra duas vezes.
function mergeLocations(atual: LocationEntry[], novos: LocationEntry[]): LocationEntry[] {
  const chave = (l: LocationEntry) => `${l.lat.toFixed(4)}|${l.lng.toFixed(4)}|${l.radius}`;
  const existentes = new Set(atual.map(chave));
  return [...atual, ...novos.filter((l) => !existentes.has(chave(l)))];
}

function locationsToPins(locations: LocationEntry[], excluded: LocationEntry[] = []): LocationGroupPin[] {
  const toPin = (l: LocationEntry, exclude: boolean): LocationGroupPin => ({
    name: l.name,
    lat: l.lat,
    lng: l.lng,
    radius: l.radius,
    ...(exclude ? { exclude: true } : {}),
  });
  return [...locations.map((l) => toPin(l, false)), ...excluded.map((l) => toPin(l, true))];
}

// "Duplicar pra outra conta": escolhe BM > conta de destino (qualquer uma —
// os pins não têm nenhuma dependência da conta de origem, então não
// importa se é outra BM). Duplicar pra MESMA conta não passa por aqui —
// vira um clique só no card, já que o destino já é conhecido.
function DuplicateToOtherAccountDialog({
  group,
  onOpenChange,
  onDuplicated,
}: {
  group: LocationGroup | null;
  onOpenChange: (open: boolean) => void;
  onDuplicated: () => void;
}) {
  const [targetBm, setTargetBm] = useState<{ id: string; name: string } | null>(null);
  const [targetAccount, setTargetAccount] = useState<{ id: string; name: string } | null>(null);
  const [pickerResetKey, setPickerResetKey] = useState(0);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (group) {
      setName(`${group.name} - Cópia`);
      setTargetBm(null);
      setTargetAccount(null);
      setPickerResetKey((k) => k + 1);
    }
  }, [group]);

  const handleDuplicate = async () => {
    if (!group || !targetAccount) return;
    setSaving(true);
    try {
      await metaCreationService.duplicateLocationGroup(group.id, targetAccount.id, name.trim() || undefined);
      toast.success(`Grupo duplicado para "${targetAccount.name}".`);
      onOpenChange(false);
      onDuplicated();
    } catch (error) {
      toast.error(apiErrorMessage(error, true) || 'Erro ao duplicar o grupo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(group)} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-800 border-slate-700 text-slate-200 max-w-sm">
        <DialogHeader>
          <DialogTitle>Duplicar para outra conta</DialogTitle>
          <DialogDescription className="text-slate-400">
            Escolha a Business Manager e a conta de anúncio de destino para "{group?.name}".
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {!targetAccount ? (
            <MetaScopedEntityPicker
              stepTwoLabel="Conta de anúncio de destino"
              fetchStepTwo={(bmId) => clientGoalsService.listAdAccountsForBm(bmId)}
              onSelect={setTargetAccount}
              selectedBm={targetBm}
              onSelectBm={setTargetBm}
              resetKey={pickerResetKey}
            />
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <button
                  type="button"
                  onClick={() => {
                    setTargetAccount(null);
                    setPickerResetKey((k) => k + 1);
                  }}
                  className="text-sky-400 hover:underline break-words min-w-0"
                >
                  {targetBm?.name} / {targetAccount.name}
                </button>
              </div>
              <div>
                <Label className="text-xs text-slate-400">Nome do grupo copiado</Label>
                <Input
                  value={name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-slate-200"
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-600 text-slate-300">
            Cancelar
          </Button>
          <Button onClick={handleDuplicate} disabled={!targetAccount || saving}>
            {saving ? 'Duplicando...' : 'Duplicar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Um mesmo pin (nome+coordenada) pode existir em vários grupos — "Lista de
// Locais" achata todos os grupos da conta numa lista só, uma linha por
// localização única, com quais grupos a usam.
interface BankItem {
  key: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
  groups: LocationGroup[];
}

function buildLocationBank(groups: LocationGroup[]): BankItem[] {
  const map = new Map<string, BankItem>();
  for (const g of groups) {
    for (const p of g.pins) {
      const key = `${p.name}|${p.lat.toFixed(4)}|${p.lng.toFixed(4)}`;
      const existing = map.get(key);
      if (existing) existing.groups.push(g);
      else map.set(key, { key, name: p.name, lat: p.lat, lng: p.lng, radius: p.radius, groups: [g] });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

// "Lista de Locais": em modo `manage` (botão de topo) mostra cada localização
// já salva nesta conta, individualmente, com editar (renomeia/ajusta raio em
// TODOS os grupos onde aparece) e excluir (remove de todos). Em modo `pick`
// (chamado de dentro do editor de um grupo) só marca quais adicionar ao
// grupo que está sendo criado/editado agora.
function LocationBankDialog({
  open,
  onOpenChange,
  groups,
  mode,
  onPick,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: LocationGroup[];
  mode: 'manage' | 'pick';
  onPick?: (locations: LocationEntry[]) => void;
  onChanged?: () => void;
}) {
  const bank = useMemo(() => buildLocationBank(groups), [groups]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<BankItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editRadius, setEditRadius] = useState('15');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    if (open) setSelectedKeys(new Set());
  }, [open]);

  const togglePick = (key: string) =>
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const handleAddSelected = () => {
    const chosen = bank.filter((b) => selectedKeys.has(b.key));
    onPick?.(chosen.map((b) => ({ id: crypto.randomUUID(), name: b.name, lat: b.lat, lng: b.lng, radius: b.radius })));
    onOpenChange(false);
  };

  const openEdit = (item: BankItem) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditRadius(String(item.radius));
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    const newName = editName.trim();
    const newRadius = parseInt(editRadius, 10);
    if (!newName || !(newRadius > 0)) {
      toast.error('Preencha nome e raio válidos.');
      return;
    }
    setBusyKey(editingItem.key);
    try {
      await Promise.all(
        editingItem.groups.map((g) => {
          const pins = g.pins.map((p) =>
            p.name === editingItem.name && p.lat === editingItem.lat && p.lng === editingItem.lng
              ? { ...p, name: newName, radius: newRadius }
              : p,
          );
          return metaCreationService.updateLocationGroup(g.id, { pins });
        }),
      );
      toast.success(`Atualizado em ${editingItem.groups.length} grupo(s).`);
      setEditingItem(null);
      onChanged?.();
    } catch (error) {
      toast.error(apiErrorMessage(error, true) || 'Erro ao atualizar a localização.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleDelete = async (item: BankItem) => {
    const groupNames = item.groups.map((g) => g.name).join(', ');
    if (
      !window.confirm(
        `Remover "${item.name}" dos grupos: ${groupNames}?\n\nUm grupo não pode ficar sem nenhuma localização — se for a última desse grupo, exclua o grupo inteiro em vez desta localização.`,
      )
    )
      return;
    setBusyKey(item.key);
    try {
      for (const g of item.groups) {
        const pins = g.pins.filter((p) => !(p.name === item.name && p.lat === item.lat && p.lng === item.lng));
        await metaCreationService.updateLocationGroup(g.id, { pins });
      }
      toast.success('Localização removida.');
      onChanged?.();
    } catch (error) {
      toast.error(apiErrorMessage(error, true) || 'Não consegui remover de todos os grupos — um deles ficaria sem nenhuma localização.');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="bg-slate-800 border-slate-700 text-slate-200 sm:max-w-2xl max-h-[85vh] overflow-y-auto"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Lista de Locais</DialogTitle>
            <DialogDescription className="text-slate-400">
              {mode === 'pick'
                ? 'Escolha localizações já usadas nesta conta para adicionar a este grupo.'
                : 'Cada localização já salva nesta conta, individualmente, e em quais grupos ela aparece.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-[55vh] overflow-y-auto">
            {bank.length === 0 ? (
              <div className="text-center text-sm text-slate-400 py-8">Nenhuma localização salva ainda nesta conta.</div>
            ) : (
              bank.map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-2 p-2 rounded-md border border-slate-700 bg-slate-900/40">
                  <div className="min-w-0 flex-1 flex items-center gap-2">
                    {mode === 'pick' && <Checkbox checked={selectedKeys.has(item.key)} onCheckedChange={() => togglePick(item.key)} />}
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-slate-200">{item.name}</span>
                      <span className="text-xs text-slate-400 ml-1">({item.radius}km)</span>
                      <p className="text-xs text-slate-500 truncate">Em: {item.groups.map((g) => g.name).join(', ')}</p>
                    </div>
                  </div>
                  {mode === 'manage' && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="ghost" disabled={busyKey === item.key} onClick={() => openEdit(item)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" disabled={busyKey === item.key} onClick={() => handleDelete(item)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-600 text-slate-300">
              {mode === 'pick' ? 'Cancelar' : 'Fechar'}
            </Button>
            {mode === 'pick' && (
              <Button onClick={handleAddSelected} disabled={selectedKeys.size === 0}>
                Adicionar {selectedKeys.size > 0 ? selectedKeys.size : ''} selecionada{selectedKeys.size === 1 ? '' : 's'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingItem)} onOpenChange={(o) => !o && setEditingItem(null)}>
        <DialogContent className="bg-slate-800 border-slate-700 text-slate-200 max-w-xs">
          <DialogHeader>
            <DialogTitle>Editar localização</DialogTitle>
            <DialogDescription className="text-slate-400">
              Atualiza em {editingItem?.groups.length} grupo(s): {editingItem?.groups.map((g) => g.name).join(', ')}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs text-slate-400">Nome</Label>
              <Input value={editName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditName(e.target.value)} className="bg-slate-700 border-slate-600 text-slate-200" />
            </div>
            <div>
              <Label className="text-xs text-slate-400">Raio (km)</Label>
              <Input
                type="number"
                min={1}
                max={80}
                value={editRadius}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditRadius(e.target.value)}
                className="bg-slate-700 border-slate-600 text-slate-200"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)} className="border-slate-600 text-slate-300">
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={busyKey === editingItem?.key}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Junta os pins com o mesmo nome vindos de vários públicos salvos num único
// grupo-candidato — sem isso, uma conta com 50 públicos salvos usando a
// mesma "Grande SP" geraria 50 sugestões idênticas em vez de uma.
function signatureFor(pins: LocationEntry[]): string {
  return pins
    .map((p) => `${p.name}|${p.lat.toFixed(4)}|${p.lng.toFixed(4)}|${p.radius}`)
    .sort()
    .join(';');
}

interface ImportCandidate {
  key: string;
  pins: LocationEntry[];
  audienceNames: string[];
  name: string;
  selected: boolean;
}

// "Importar de públicos salvos": lê os públicos salvos de verdade na Meta
// (targeting completo, incluindo geo), extrai só a parte geográfica de cada
// um, agrupa os que têm o MESMO conjunto de localizações num candidato só
// (deduplicado), e deixa a pessoa escolher quais viram Grupo de Localização
// de verdade — nada é salvo até confirmar.
function ImportFromSavedAudiencesDialog({
  open,
  onOpenChange,
  accountId,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  onImported: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    setCandidates([]);
    setLoading(true);
    (async () => {
      try {
        const audiences = await metaCreationService.listSavedAudiences(accountId);
        const bySignature = new Map<string, ImportCandidate>();
        const unresolved: string[] = [];
        for (const audience of audiences) {
          const geo = audience.targeting?.geo_locations;
          if (!geo) continue;
          const raw = [
            ...(geo.cities || []).map((c) => ({ name: c.name, region: c.region, country: c.country, lat: c.lat, lng: c.lng, radius: c.radius })),
            ...(geo.places || []).map((c) => ({ name: c.name, region: c.region, country: c.country, lat: c.lat, lng: c.lng, radius: c.radius })),
            ...(geo.custom_locations || []).map((c) => ({ lat: c.latitude, lng: c.longitude, radius: c.radius })),
          ];
          if (raw.length === 0) continue;
          const pins = await pinsFromOrigin(raw, unresolved);
          if (pins.length === 0) continue;
          const sig = signatureFor(pins);
          const existing = bySignature.get(sig);
          if (existing) existing.audienceNames.push(audience.name);
          else bySignature.set(sig, { key: sig, pins, audienceNames: [audience.name], name: audience.name, selected: false });
        }
        if (cancelado) return;
        setCandidates(Array.from(bySignature.values()));
        if (unresolved.length > 0) toast.warning(`Não consegui localizar no mapa: ${unresolved.join(', ')}.`);
      } catch {
        if (!cancelado) toast.error('Erro ao carregar os públicos salvos desta conta.');
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [open, accountId]);

  const toggleSelected = (key: string) => setCandidates((prev) => prev.map((c) => (c.key === key ? { ...c, selected: !c.selected } : c)));
  const updateName = (key: string, name: string) => setCandidates((prev) => prev.map((c) => (c.key === key ? { ...c, name } : c)));
  const selectedCount = candidates.filter((c) => c.selected).length;

  const handleSave = async () => {
    const chosen = candidates.filter((c) => c.selected);
    if (chosen.length === 0) return;
    setSaving(true);
    try {
      await Promise.all(
        chosen.map((c) => metaCreationService.createLocationGroup(accountId, c.name.trim() || 'Grupo importado', locationsToPins(c.pins))),
      );
      toast.success(`${chosen.length} grupo(s) criado(s) a partir dos públicos salvos.`);
      onOpenChange(false);
      onImported();
    } catch (error) {
      toast.error(apiErrorMessage(error, true) || 'Erro ao salvar os grupos selecionados.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-slate-800 border-slate-700 text-slate-200 sm:max-w-2xl max-h-[85vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Importar de públicos salvos</DialogTitle>
          <DialogDescription className="text-slate-400">
            Lidos os públicos salvos desta conta na Meta e agrupadas as localizações — públicos com o mesmo conjunto de lugares viram UM
            grupo só, não um por público. Nada é salvo até você confirmar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2 max-h-[55vh] overflow-y-auto">
          {loading ? (
            <div className="text-center text-sm text-slate-400 py-8">Lendo públicos salvos da Meta...</div>
          ) : candidates.length === 0 ? (
            <div className="text-center text-sm text-slate-400 py-8 border border-dashed border-slate-700 rounded-md">
              Nenhum público salvo desta conta tem segmentação geográfica por região/cidade para importar.
            </div>
          ) : (
            candidates.map((c) => (
              <div key={c.key} className="flex items-start gap-3 p-3 rounded-lg border border-slate-700">
                <Checkbox checked={c.selected} onCheckedChange={() => toggleSelected(c.key)} className="mt-1" />
                <div className="flex-1 min-w-0 space-y-1">
                  <Input
                    value={c.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateName(c.key, e.target.value)}
                    className="bg-slate-700 border-slate-600 text-slate-200 text-sm h-8"
                  />
                  <p className="text-xs text-slate-400">
                    {c.pins.length} {c.pins.length === 1 ? 'localização' : 'localizações'}: {c.pins.map((p) => `${p.name} (${p.radius}km)`).join(', ')}
                  </p>
                  <p className="text-xs text-slate-500">Vem de: {c.audienceNames.join(', ')}</p>
                </div>
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-600 text-slate-300">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={selectedCount === 0 || saving}>
            {saving ? 'Salvando...' : `Salvar ${selectedCount > 0 ? selectedCount : ''} selecionado${selectedCount === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LocationGroupEditorDialog({
  open,
  onOpenChange,
  group,
  allGroups,
  accountId,
  onSaved,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: LocationGroup | null;
  allGroups: LocationGroup[];
  accountId: string;
  onSaved: () => void;
  onSave: (name: string, pins: LocationGroupPin[], group: LocationGroup | null) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [locations, setLocations] = useState<LocationEntry[]>([]);
  const [excludedLocations, setExcludedLocations] = useState<LocationEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(group?.name || '');
    setLocations(group ? pinsToLocations(group.pins) : []);
    setExcludedLocations(group ? pinsToLocations(group.pins, true) : []);
  }, [open, group]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Dê um nome ao grupo.');
      return;
    }
    if (locations.length === 0) {
      toast.error('Adicione pelo menos uma localização.');
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed, locationsToPins(locations, excludedLocations), group);
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(apiErrorMessage(error, true) || 'Erro ao salvar o grupo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-slate-800 border-slate-700 text-slate-200 inset-0! translate-x-0! translate-y-0! top-0! left-0! w-screen! h-[100dvh]! max-w-none! max-h-none! rounded-none! flex flex-col p-4 sm:p-6"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{group ? 'Editar grupo de localização' : 'Novo grupo de localização'}</DialogTitle>
          <DialogDescription className="text-slate-400">
            Defina as regiões e o raio de cada uma. O grupo fica salvo nesta conta de anúncio e pode ser reaproveitado (ou duplicado) depois.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 flex flex-col gap-4 py-2">
          <div>
            <Label className="text-xs text-slate-400">Nome do grupo</Label>
            <Input
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder="Ex: Grande SP + Litoral"
              className="bg-slate-700 border-slate-600 text-slate-200"
            />
          </div>
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between gap-2 mb-2">
              <Label className="text-xs text-slate-400">Regiões e raio</Label>
              {allGroups.length > 0 && (
                <Button type="button" variant="outline" size="sm" onClick={() => setBankOpen(true)}>
                  <ListChecks className="w-3.5 h-3.5 mr-1" /> Escolher de locais já usados
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <Import className="w-3.5 h-3.5 mr-1" /> Importar de…
              </Button>
            </div>
            <LocationImportDialog
              open={importOpen}
              onOpenChange={setImportOpen}
              accountId={accountId}
              groups={allGroups}
              currentGroupId={group?.id}
              onImport={(pins) => {
                setLocations((prev) => mergeLocations(prev, pinsToLocations(pins)));
                setExcludedLocations((prev) => mergeLocations(prev, pinsToLocations(pins, true)));
              }}
            />
            <LocationMapPicker
              locations={locations}
              onChange={setLocations}
              excludedLocations={excludedLocations}
              onExcludedChange={setExcludedLocations}
              fullHeight
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-600 text-slate-300">
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>

      <LocationBankDialog
        open={bankOpen}
        onOpenChange={setBankOpen}
        groups={allGroups}
        mode="pick"
        onPick={(picked) =>
          setLocations((prev) => {
            const existingNames = new Set(prev.map((l) => l.name));
            return [...prev, ...picked.filter((p) => !existingNames.has(p.name))];
          })
        }
      />
    </Dialog>
  );
}

// Aba "Grupos de Localização" da Criação Meta: regiões + raio salvas POR
// CONTA DE ANÚNCIO (diferente das Listas de Direcionamento do Direcionamento
// Detalhado, que são globais), reaproveitáveis e duplicáveis tanto dentro da
// mesma conta quanto pra outra. Segue o mesmo padrão self-contained de
// account picker do TargetingBuilder (BM > Conta próprios, não os do resto
// da página).
export function LocationGroupsTab() {
  // Conta e BM compartilhadas com a página (ver MetaAdAccountScopeContext).
  const { account, setAccount, bm: selectedBm, setBm: setSelectedBm, pickerKey: pickerResetKey, resetPicker } = useMetaAdAccountScope();

  const [groups, setGroups] = useState<LocationGroup[] | null>(null);
  const [loading, setLoading] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<LocationGroup | null>(null);
  const [duplicatingGroup, setDuplicatingGroup] = useState<LocationGroup | null>(null);
  const [duplicatingSameAccountId, setDuplicatingSameAccountId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [bankManageOpen, setBankManageOpen] = useState(false);

  const loadGroups = useCallback((accountId: string) => {
    setLoading(true);
    metaCreationService
      .listLocationGroups(accountId)
      .then(setGroups)
      .catch(() => toast.error('Erro ao carregar os grupos de localização'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (account) loadGroups(account.id);
  }, [account, loadGroups]);

  const openCreate = () => {
    setEditingGroup(null);
    setEditorOpen(true);
  };

  const openEdit = (group: LocationGroup) => {
    setEditingGroup(group);
    setEditorOpen(true);
  };

  const handleSaveEditor = async (name: string, pins: LocationGroupPin[], existing: LocationGroup | null) => {
    if (existing) {
      await metaCreationService.updateLocationGroup(existing.id, { name, pins });
      toast.success('Grupo atualizado.');
    } else {
      if (!account) return;
      await metaCreationService.createLocationGroup(account.id, name, pins);
      toast.success('Grupo criado.');
    }
  };

  // Duplicar pra MESMA conta: um clique só, sem diálogo — o destino já é
  // conhecido (a conta selecionada agora).
  const handleDuplicateSameAccount = async (group: LocationGroup) => {
    if (!account || duplicatingSameAccountId) return;
    setDuplicatingSameAccountId(group.id);
    try {
      await metaCreationService.duplicateLocationGroup(group.id, account.id);
      toast.success('Grupo duplicado nesta conta.');
      loadGroups(account.id);
    } catch (error) {
      toast.error(apiErrorMessage(error, true) || 'Erro ao duplicar o grupo.');
    } finally {
      setDuplicatingSameAccountId(null);
    }
  };

  const handleDelete = async (group: LocationGroup) => {
    if (!window.confirm(`Excluir o grupo "${group.name}"? Isso não afeta conjuntos de anúncios que já usaram essas localizações.`)) return;
    try {
      await metaCreationService.deleteLocationGroup(group.id);
      toast.success('Grupo excluído.');
      if (account) loadGroups(account.id);
    } catch {
      toast.error('Erro ao excluir o grupo.');
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
          <div className="flex items-center justify-between gap-2 flex-wrap">
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
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setBankManageOpen(true)}>
                <ListChecks className="w-4 h-4 mr-1.5" /> Lista de Locais
              </Button>
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Import className="w-4 h-4 mr-1.5" /> Importar de públicos salvos
              </Button>
              <Button onClick={openCreate}>
                <Plus className="w-4 h-4 mr-1.5" /> Novo grupo de localização
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="text-center text-sm text-muted-foreground py-10">Carregando...</div>
          ) : !groups || groups.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-10 border border-dashed rounded-md">
              Nenhum grupo de localização criado ainda nesta conta.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {groups.map((group) => (
                <div key={group.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                  <h4 className="text-sm font-semibold break-words min-w-0 flex items-center gap-1.5" title={group.name}>
                    <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0" /> {group.name}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {group.pins.length} {group.pins.length === 1 ? 'localização' : 'localizações'}:{' '}
                    {group.pins.map((p) => `${p.name} (${p.radius}km)`).join(', ')}
                  </p>
                  <div className="pt-1 flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(group)}>
                      <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={duplicatingSameAccountId === group.id}
                      onClick={() => handleDuplicateSameAccount(group)}
                    >
                      <Copy className="w-3.5 h-3.5 mr-1" /> Duplicar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setDuplicatingGroup(group)}>
                      <Copy className="w-3.5 h-3.5 mr-1" /> Duplicar p/ outra conta
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(group)}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <LocationGroupEditorDialog
            open={editorOpen}
            onOpenChange={setEditorOpen}
            group={editingGroup}
            allGroups={groups || []}
            accountId={account?.id || ''}
            onSave={handleSaveEditor}
            onSaved={() => account && loadGroups(account.id)}
          />

          <DuplicateToOtherAccountDialog
            group={duplicatingGroup}
            onOpenChange={(open) => !open && setDuplicatingGroup(null)}
            onDuplicated={() => account && loadGroups(account.id)}
          />

          <ImportFromSavedAudiencesDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            accountId={account.id}
            onImported={() => loadGroups(account.id)}
          />

          <LocationBankDialog
            open={bankManageOpen}
            onOpenChange={setBankManageOpen}
            groups={groups || []}
            mode="manage"
            onChanged={() => loadGroups(account.id)}
          />
        </>
      )}
    </div>
  );
}
