import { useState } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@evoapi/design-system';
import { ExternalLink, Plug, Check, Loader2, AlertCircle } from 'lucide-react';
import { CompactIntegrationCard } from '@/components/integrations/CompactIntegrationCard';
import ElevenLabsConfigDialog from '@/components/integrations/ElevenLabsConfigDialog';
import GoogleCalendarConfigDialog from '@/components/integrations/GoogleCalendarConfigDialog';
import GoogleSheetsConfigDialog from '@/components/integrations/GoogleSheetsConfigDialog';
import KnowledgeNexusConfigDialog, {
  type KnowledgeNexusConfig,
} from '@/components/integrations/KnowledgeNexusConfigDialog';
import { useIntegrations } from '@/hooks/useIntegrations';
import { agentIntegrationsService } from '@/services/agents/agentIntegrationsService';
import { toast } from 'sonner';

interface Integration {
  id: string;
  name: string;
  description: string;
}

interface IntegrationsSectionProps {
  integrations?: Record<string, unknown>;
  onIntegrationsChange?: (integrations: Record<string, unknown>) => void;
  agentId: string;
}

const IntegrationsSection = ({
  integrations = {},
  onIntegrationsChange,
  agentId,
}: IntegrationsSectionProps) => {
  const { t } = useLanguage('aiAgents');
  const [showElevenLabsConfig, setShowElevenLabsConfig] = useState(false);
  const [showGoogleCalendarConfig, setShowGoogleCalendarConfig] = useState(false);
  const [showGoogleSheetsConfig, setShowGoogleSheetsConfig] = useState(false);
  const [showKnowledgeNexusConfig, setShowKnowledgeNexusConfig] = useState(false);

  // Use custom hook for integrations status.
  // `available` is the DISPONIBILIDADE signal (CRM :3000 endpoint) used to gate
  // "Em breve"/ATIVAR-disabled; `isConnected` is the per-agent "connected" state.
  const { available, isCheckingIntegrations, isConnected, reloadConfigs } =
    useIntegrations(agentId);

  // Persist an integration immediately via the backend Upsert endpoint, then
  // update local state. This is necessary because `agent.config.integrations`
  // is ignored by the backend's persistence layer for OAuth/native integrations
  // — the canonical store is the `agent_integrations` table behind
  // POST /agents/:id/integrations.
  const persistIntegration = async (
    provider: string,
    config: Record<string, unknown>
  ): Promise<boolean> => {
    if (!agentId) {
      toast.error(t('messages.saveError') || 'Agent must be saved first');
      return false;
    }
    try {
      await agentIntegrationsService.upsertIntegration(agentId, provider, {
        ...config,
        connected: true,
      });
      if (onIntegrationsChange) {
        onIntegrationsChange({ ...integrations, [provider]: { ...config, connected: true } });
      }
      await reloadConfigs();
      toast.success(t('edit.integrations.activated') || 'Integration activated');
      return true;
    } catch (error) {
      console.error(`Error upserting integration ${provider}:`, error);
      toast.error(t('edit.integrations.activationError') || 'Failed to activate integration');
      return false;
    }
  };

  const removeIntegration = async (provider: string): Promise<boolean> => {
    if (!agentId) return false;
    try {
      await agentIntegrationsService.deleteIntegration(agentId, provider);
      if (onIntegrationsChange) {
        const next = { ...integrations };
        delete next[provider];
        onIntegrationsChange(next);
      }
      await reloadConfigs();
      toast.success(t('edit.integrations.deactivated') || 'Integration deactivated');
      return true;
    } catch (error) {
      console.error(`Error deleting integration ${provider}:`, error);
      toast.error(t('edit.integrations.deactivationError') || 'Failed to deactivate integration');
      return false;
    }
  };

  // Integrações que sempre estão disponíveis porque o usuário fornece sua
  // própria credencial (API key). Não dependem de OAuth global configurado
  // pelo administrador. Google Calendar / Sheets usam OAuth global e portanto
  // só ficam disponíveis quando o mapa `available` (endpoint de disponibilidade
  // do CRM) indica que o admin configurou as chaves correspondentes.
  // Google Calendar / Sheets connect via per-agent OAuth (their own config
  // dialogs), not a globally-configured client credential — so they are always
  // available, like ElevenLabs (API key). Keeping them out of this list left them
  // stuck on "NÃO DISPONÍVEL" despite the render logic already wiring their dialogs.
  const ALWAYS_AVAILABLE_INTEGRATIONS = ['elevenlabs', 'knowledge-nexus', 'google-calendar', 'google-sheets'];

  const availableIntegrations: Integration[] = [
    {
      id: 'elevenlabs',
      name: 'ElevenLabs',
      description:
        t('edit.integrations.elevenlabs.description') ||
        'Com ElevenLabs você da a capacidade do seu agente responder seus clientes em áudio, tornando ainda mais humanizado.',
    },
    {
      id: 'google-calendar',
      name: 'Google Calendar',
      description:
        t('edit.integrations.googleCalendar.description') ||
        'Permite agendar eventos, verificar disponibilidade e gerenciar calendários.',
    },
    {
      id: 'google-sheets',
      name: 'Google Sheets',
      description:
        t('edit.integrations.googleSheets.description') ||
        'Permite criar, ler, atualizar e gerenciar planilhas do Google Sheets.',
    },
    {
      id: 'knowledge-nexus',
      name: 'Knowledge Nexus',
      description:
        t('edit.integrations.knowledgeNexus.description') ||
        'Permite que o agente consulte a base de conhecimento do EvoNexus (busca híbrida) antes de responder.',
    },
    // {
    //   id: 'gmail',
    //   name: 'Gmail',
    //   description: t('edit.integrations.gmail.description') || 'Conecte o agente ao Gmail para ler, enviar e gerenciar emails automaticamente.',
    // },
    // {
    //   id: 'google-drive',
    //   name: 'Google Drive',
    //   description: t('edit.integrations.googleDrive.description') || 'Permite que o agente acesse, busque e gerencie arquivos no Google Drive.',
    // }
  ];

  return (
    <div className="space-y-8">
      {/* Cabeçalho da Seção */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 pb-2 border-b">
          <div className="p-2 rounded-lg bg-indigo-500/10">
            <Plug className="h-5 w-5 text-indigo-500" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              {t('edit.integrations.subtitle') ||
                'Conecte o seu agente a outros aplicativos, isso permite que ele obtenha informações mais precisas ou agende reuniões para você.'}
            </p>
          </div>
        </div>

        <div>
          {isCheckingIntegrations ? (
            <div className="flex flex-col gap-3 items-center py-12 h-32 text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin" />
              <div className="text-sm">
                {t('integrations.checking') || 'Verificando integrações...'}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {availableIntegrations.map(integration => {
                // Integrações que sempre estão disponíveis (ElevenLabs usa API Key, Google Calendar configurado localmente)
                const isAlwaysAvailable = ALWAYS_AVAILABLE_INTEGRATIONS.includes(integration.id);
                const hasCredentials =
                  isAlwaysAvailable || (available[integration.id] ?? false);
                const connected = isConnected(integration.id);

                const openConfigDialog = () => {
                  if (integration.id === 'elevenlabs') {
                    setShowElevenLabsConfig(true);
                  } else if (integration.id === 'google-calendar') {
                    setShowGoogleCalendarConfig(true);
                  } else if (integration.id === 'google-sheets') {
                    setShowGoogleSheetsConfig(true);
                  } else if (integration.id === 'knowledge-nexus') {
                    setShowKnowledgeNexusConfig(true);
                  }
                };

                // Estados do botão: Em breve (sem credencial global) → Ativar → ✓ Ativado.
                // "Ativado" continua clicável porque é também a porta de entrada para
                // reconfigurar/desativar a integração pelo dialog.
                const action = connected ? (
                  <Button
                    variant="outline"
                    className="w-full gap-2 border-green-600/40 text-green-600 hover:text-green-700 md:w-auto"
                    onClick={openConfigDialog}
                    title={t('edit.integrations.configure') || 'Configurar'}
                  >
                    <Check className="h-4 w-4" />
                    {t('edit.integrations.active') || 'Ativado'}
                  </Button>
                ) : hasCredentials ? (
                  <Button
                    variant="outline"
                    className="w-full gap-2 md:w-auto"
                    onClick={openConfigDialog}
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t('edit.integrations.activate') || 'Ativar'}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full cursor-not-allowed gap-2 border-gray-300 text-gray-500 md:w-auto"
                    disabled
                  >
                    <AlertCircle className="h-4 w-4" />
                    {t('edit.integrations.notAvailable') || 'Em breve'}
                  </Button>
                );

                return (
                  <CompactIntegrationCard
                    key={integration.id}
                    id={integration.id}
                    name={integration.name}
                    description={integration.description}
                    action={action}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Dialog de configuração ElevenLabs */}
      <ElevenLabsConfigDialog
        open={showElevenLabsConfig}
        onOpenChange={setShowElevenLabsConfig}
        initialConfig={
          integrations.elevenlabs as
            | Partial<{
                apiKey: string;
                respondInAudio: 'when_client_asks' | 'always' | 'never';
                voice: string;
                stability: number;
                similarity: number;
              }>
            | undefined
        }
        onSave={async config => {
          await persistIntegration('elevenlabs', config as unknown as Record<string, unknown>);
        }}
        onDeactivate={
          integrations.elevenlabs
            ? async () => {
                await removeIntegration('elevenlabs');
              }
            : undefined
        }
      />

      {/* Dialog de configuração Google Calendar */}
      <GoogleCalendarConfigDialog
        open={showGoogleCalendarConfig}
        onOpenChange={setShowGoogleCalendarConfig}
        agentId={agentId}
        initialConfig={
          integrations['google-calendar'] as Parameters<
            typeof GoogleCalendarConfigDialog
          >[0]['initialConfig']
        }
        onSave={config => {
          if (onIntegrationsChange) {
            onIntegrationsChange({
              ...integrations,
              'google-calendar': config,
            });
          }
          // Reload configs to update status
          reloadConfigs();
        }}
        onDisconnect={
          integrations['google-calendar']
            ? () => {
                if (onIntegrationsChange) {
                  const newIntegrations = { ...integrations };
                  delete newIntegrations['google-calendar'];
                  onIntegrationsChange(newIntegrations);
                }
                // Reload configs to update status
                reloadConfigs();
              }
            : undefined
        }
      />

      {/* Dialog de configuração Google Sheets */}
      <GoogleSheetsConfigDialog
        open={showGoogleSheetsConfig}
        onOpenChange={setShowGoogleSheetsConfig}
        agentId={agentId}
        initialConfig={
          integrations['google-sheets'] as Parameters<
            typeof GoogleSheetsConfigDialog
          >[0]['initialConfig']
        }
        onSave={config => {
          if (onIntegrationsChange) {
            onIntegrationsChange({
              ...integrations,
              'google-sheets': config,
            });
          }
          // Reload configs to update status
          reloadConfigs();
        }}
        onDisconnect={
          integrations['google-sheets']
            ? () => {
                if (onIntegrationsChange) {
                  const newIntegrations = { ...integrations };
                  delete newIntegrations['google-sheets'];
                  onIntegrationsChange(newIntegrations);
                }
                // Reload configs to update status
                reloadConfigs();
              }
            : undefined
        }
      />

      {/* Dialog de configuração Knowledge Nexus */}
      <KnowledgeNexusConfigDialog
        open={showKnowledgeNexusConfig}
        onOpenChange={setShowKnowledgeNexusConfig}
        initialConfig={
          integrations['knowledge-nexus'] as Partial<KnowledgeNexusConfig> | undefined
        }
        onSave={async config => {
          await persistIntegration(
            'knowledge-nexus',
            config as unknown as Record<string, unknown>
          );
        }}
        onDeactivate={
          integrations['knowledge-nexus']
            ? async () => {
                await removeIntegration('knowledge-nexus');
              }
            : undefined
        }
      />
    </div>
  );
};

export default IntegrationsSection;
