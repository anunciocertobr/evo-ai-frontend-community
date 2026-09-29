import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@evoapi/design-system';
import { Building2, Copy, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { MetaScopedEntityPicker } from '@/components/marketing/MetaScopedEntityPicker';
import { LocationMapPicker, type LocationEntry } from '@/components/marketing/LocationMapPicker';
import { clientGoalsService } from '@/services/marketing/clientGoalsService';
import { metaCreationService, type LocationGroup, type LocationGroupPin } from '@/services/marketing/metaCreationService';
import { apiErrorMessage } from '@/utils/apiHelpers';

function pinsToLocations(pins: LocationGroupPin[]): LocationEntry[] {
  return pins.map((p) => ({ id: crypto.randomUUID(), name: p.name, lat: p.lat, lng: p.lng, radius: p.radius }));
}

function locationsToPins(locations: LocationEntry[]): LocationGroupPin[] {
  return locations.map((l) => ({ name: l.name, lat: l.lat, lng: l.lng, radius: l.radius }));
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

function LocationGroupEditorDialog({
  open,
  onOpenChange,
  group,
  onSaved,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: LocationGroup | null;
  onSaved: () => void;
  onSave: (name: string, pins: LocationGroupPin[], group: LocationGroup | null) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [locations, setLocations] = useState<LocationEntry[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(group?.name || '');
    setLocations(group ? pinsToLocations(group.pins) : []);
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
      await onSave(trimmed, locationsToPins(locations), group);
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
        className="bg-slate-800 border-slate-700 text-slate-200 sm:max-w-lg max-h-[85vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{group ? 'Editar grupo de localização' : 'Novo grupo de localização'}</DialogTitle>
          <DialogDescription className="text-slate-400">
            Defina as regiões e o raio de cada uma. O grupo fica salvo nesta conta de anúncio e pode ser reaproveitado (ou duplicado) depois.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs text-slate-400">Nome do grupo</Label>
            <Input
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder="Ex: Grande SP + Litoral"
              className="bg-slate-700 border-slate-600 text-slate-200"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-400 block mb-2">Regiões e raio</Label>
            <LocationMapPicker locations={locations} onChange={setLocations} singleListMode />
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
  const [account, setAccount] = useState<{ id: string; name: string } | null>(null);
  const [selectedBm, setSelectedBm] = useState<{ id: string; name: string } | null>(null);
  const [pickerResetKey, setPickerResetKey] = useState(0);

  const [groups, setGroups] = useState<LocationGroup[] | null>(null);
  const [loading, setLoading] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<LocationGroup | null>(null);
  const [duplicatingGroup, setDuplicatingGroup] = useState<LocationGroup | null>(null);
  const [duplicatingSameAccountId, setDuplicatingSameAccountId] = useState<string | null>(null);

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
                  setPickerResetKey((k) => k + 1);
                }}
                className="text-primary hover:underline break-words min-w-0"
                title={account.name}
              >
                {account.name}
              </button>
            </div>
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1.5" /> Novo grupo de localização
            </Button>
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
            onSave={handleSaveEditor}
            onSaved={() => account && loadGroups(account.id)}
          />

          <DuplicateToOtherAccountDialog
            group={duplicatingGroup}
            onOpenChange={(open) => !open && setDuplicatingGroup(null)}
            onDuplicated={() => account && loadGroups(account.id)}
          />
        </>
      )}
    </div>
  );
}
