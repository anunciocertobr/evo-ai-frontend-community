import { useEffect, useState } from 'react';
import { Palette, MessageSquare, Code2, Save, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { BaseHeader } from '@/components/base';
import { Button, Input, Label } from '@evoapi/design-system';
import { adminConfigService } from '@/services/admin/adminConfigService';

const CONFIG_TYPE = 'real_estate';

interface RealEstateSettings {
  REAL_ESTATE_COMPANY_NAME: string;
  REAL_ESTATE_HEADER_COLOR: string;
  REAL_ESTATE_BACKGROUND_COLOR: string;
  REAL_ESTATE_FOOTER_COLOR: string;
  REAL_ESTATE_ICON_COLOR: string;
  REAL_ESTATE_TEXT_COLOR: string;
  REAL_ESTATE_TITLE_COLOR: string;
  REAL_ESTATE_COMPANY_NAME_COLOR: string;
  REAL_ESTATE_GTM_ID: string;
  REAL_ESTATE_WHATSAPP_NUMBER: string;
}

const DEFAULTS: RealEstateSettings = {
  REAL_ESTATE_COMPANY_NAME: '',
  REAL_ESTATE_HEADER_COLOR: '#0a0a0a',
  REAL_ESTATE_BACKGROUND_COLOR: '#0a0a0a',
  REAL_ESTATE_FOOTER_COLOR: '#0a0a0a',
  REAL_ESTATE_ICON_COLOR: '#ffffff',
  REAL_ESTATE_TEXT_COLOR: '#a1a1aa',
  REAL_ESTATE_TITLE_COLOR: '#ffffff',
  REAL_ESTATE_COMPANY_NAME_COLOR: '#ffffff',
  REAL_ESTATE_GTM_ID: '',
  REAL_ESTATE_WHATSAPP_NUMBER: '',
};

const COLOR_FIELDS: Array<{ key: keyof RealEstateSettings; label: string }> = [
  { key: 'REAL_ESTATE_HEADER_COLOR', label: 'Cor do header' },
  { key: 'REAL_ESTATE_BACKGROUND_COLOR', label: 'Cor de fundo' },
  { key: 'REAL_ESTATE_FOOTER_COLOR', label: 'Cor do footer' },
  { key: 'REAL_ESTATE_ICON_COLOR', label: 'Cor dos ícones' },
  { key: 'REAL_ESTATE_TEXT_COLOR', label: 'Cor dos textos' },
  { key: 'REAL_ESTATE_TITLE_COLOR', label: 'Cor do título' },
  { key: 'REAL_ESTATE_COMPANY_NAME_COLOR', label: 'Cor do nome da empresa' },
];

export default function RealEstateSettingsPage() {
  const [settings, setSettings] = useState<RealEstateSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const config = await adminConfigService.getConfig(CONFIG_TYPE);
        setSettings((prev) => ({
          ...prev,
          ...Object.fromEntries(
            Object.entries(config).filter(([, v]) => v !== null && v !== undefined),
          ),
        }));
      } catch {
        toast.error('Erro ao carregar configurações do site de imóveis');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const set = (key: keyof RealEstateSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminConfigService.saveConfig(CONFIG_TYPE, settings as unknown as Record<string, string>);
      toast.success('Configurações do site de imóveis salvas!');
    } catch {
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Carregando...</div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      <BaseHeader title="Imobiliária" subtitle="Aparência e contato da página pública de imóveis." />
      <div className="flex items-center justify-between">
        <a
          href="/imoveis"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          Ver site de imóveis <ExternalLink className="w-3.5 h-3.5" />
        </a>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>

      {/* Identidade */}
      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Palette className="w-4 h-4 text-primary" /> Identidade visual
        </h4>
        <div className="space-y-1.5">
          <Label>Nome da empresa (exibido no topo do site)</Label>
          <Input
            value={settings.REAL_ESTATE_COMPANY_NAME}
            onChange={(e) => set('REAL_ESTATE_COMPANY_NAME', e.target.value)}
            placeholder="Ex: Imobiliária Certo"
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {COLOR_FIELDS.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label>{field.label}</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings[field.key] || '#000000'}
                  onChange={(e) => set(field.key, e.target.value)}
                  className="h-9 w-10 rounded border border-border bg-transparent cursor-pointer shrink-0"
                />
                <Input
                  value={settings[field.key]}
                  onChange={(e) => set(field.key, e.target.value)}
                  placeholder="#000000"
                  className="font-mono text-xs"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Analytics */}
      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Code2 className="w-4 h-4 text-primary" /> Analytics
        </h4>
        <div className="space-y-1.5 max-w-sm">
          <Label>GTM (Google Tag Manager) — ID do container</Label>
          <Input
            value={settings.REAL_ESTATE_GTM_ID}
            onChange={(e) => set('REAL_ESTATE_GTM_ID', e.target.value)}
            placeholder="GTM-XXXXXXX"
          />
        </div>
      </section>

      {/* Contato */}
      <section className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" /> Contato
        </h4>
        <p className="text-xs text-muted-foreground">
          Cada imóvel exibe um botão de WhatsApp que abre uma conversa com esse número, já
          mencionando o imóvel — o contato acontece direto no navegador do visitante, sem passar
          pelo CRM.
        </p>
        <div className="space-y-1.5 max-w-sm">
          <Label>Número de WhatsApp</Label>
          <Input
            value={settings.REAL_ESTATE_WHATSAPP_NUMBER}
            onChange={(e) => set('REAL_ESTATE_WHATSAPP_NUMBER', e.target.value)}
            placeholder="55 11 91234-1234"
          />
        </div>
      </section>
    </div>
  );
}
