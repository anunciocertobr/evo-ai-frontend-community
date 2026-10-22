import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Label,
  Input,
  Switch,
} from '@evoapi/design-system';
import { adminConfigService } from '@/services/admin/adminConfigService';

const CONFIG_TYPE = 'meta_conversion_leads';

interface Settings {
  [key: string]: string;
  META_CRM_ENABLED: string;
  META_CRM_DATASET_ID: string;
  META_CRM_PARTNER_AGENT: string;
}

const DEFAULTS: Settings = {
  META_CRM_ENABLED: 'false',
  META_CRM_DATASET_ID: '',
  META_CRM_PARTNER_AGENT: '',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// "Conversion Leads" da Meta — manda status do lead (qualificação, fase do
// funil) pra Meta usando leadgen_id, pra leads de Lead Ads/Instant Form
// (que não têm fbc/fbp, então o Conversions API normal não serve). Dataset e
// partner_agent são configurados do lado da Meta (Events Manager +
// representante da conta) — este dialog só guarda os valores, não cria nada
// na Meta. Sem isso configurado, qualificar/mover um card de lead Meta
// continua funcionando normal — só não envia o sinal, e avisa via toast
// (ver pipelinesService.ts#warnMetaCrmSetupIfNeeded).
export function MetaConversionLeadsSettingsDialog({ open, onOpenChange }: Props) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    adminConfigService
      .getConfig(CONFIG_TYPE)
      .then((config) => {
        const merged = {
          ...DEFAULTS,
          ...Object.fromEntries(Object.entries(config).filter(([, v]) => v !== null && v !== undefined)),
        } as Settings;
        setSettings(merged);
      })
      .catch(() => toast.error('Erro ao carregar a configuração do Conversion Leads.'))
      .finally(() => setLoading(false));
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminConfigService.saveConfig(CONFIG_TYPE, settings);
      toast.success('Configuração do Conversion Leads salva!');
      onOpenChange(false);
    } catch {
      toast.error('Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conversion Leads (Meta)</DialogTitle>
          <DialogDescription>
            Envia status do lead (qualificação, fase do funil) pra Meta pra leads de
            formulário/Instant Form. Precisa de um dataset de CRM criado em Events Manager e de um
            partner_agent combinado com o representante da sua conta Meta — nenhum dos dois dá pra
            obter por aqui.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-6">Carregando...</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Ativar envio</Label>
              <Switch
                checked={settings.META_CRM_ENABLED === 'true'}
                onCheckedChange={(checked: boolean) =>
                  setSettings((prev) => ({ ...prev, META_CRM_ENABLED: checked ? 'true' : 'false' }))
                }
              />
            </div>

            <div>
              <Label className="text-xs">Dataset ID (Events Manager &gt; Conversion Leads)</Label>
              <Input
                value={settings.META_CRM_DATASET_ID}
                onChange={(e) => setSettings((prev) => ({ ...prev, META_CRM_DATASET_ID: e.target.value }))}
                placeholder="ex: 123456789012345"
              />
            </div>

            <div>
              <Label className="text-xs">Partner Agent</Label>
              <Input
                value={settings.META_CRM_PARTNER_AGENT}
                onChange={(e) => setSettings((prev) => ({ ...prev, META_CRM_PARTNER_AGENT: e.target.value }))}
                placeholder="string combinada com o representante Meta"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
