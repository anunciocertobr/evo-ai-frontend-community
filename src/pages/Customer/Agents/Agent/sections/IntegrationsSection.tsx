import { useState } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@evoapi/design-system';
import { ExternalLink, Check, Loader2, AlertCircle } from 'lucide-react';
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

  // `available` = a integração existe no tenant (endpoint do CRM); `isConnected` =
  // este agente já a ativou. Coisas diferentes.
  const { available, isCheckingIntegrations, isConnected, reloadConfigs } =
    useIntegrations(agentId);

  // Grava direto no backend em vez de esperar o "Salvar": o `agent.config.integrations`
  // é ignorado na persistência de integrações OAuth/nativas — a fonte da verdade é a
  // tabela `agent_integrations`, atrás de POST /agents/:id/integrations.
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

  // Não dependem de credencial global do admin: a credencial é do próprio usuário.
  // Como toda a lista de baixo está aqui, "Em breve" hoje só aparece nos cards de MCP —
  // o ramo continua valendo para as integrações ainda comentadas.
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
      <div className="space-y-4">
        {/* O título do bloco já vem do cabeçalho do accordion — aqui só a descrição. */}
        <p className="pb-[18px] pt-[18px] text-[13px] leading-[1.5] text-[#8A928F]">
          {t('edit.integrations.subtitle') ||
            'Conecte o seu agente a outros aplicativos, isso permite que ele obtenha informações mais precisas ou agende reuniões para você.'}
        </p>

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

                // Em breve (sem credencial global) → Ativar → ✓ Ativado. "Ativado" segue
                // clicável: é por ele que se reconfigura ou desativa.
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
                      reloadConfigs();
              }
            : undefined
        }
      />

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
                      reloadConfigs();
              }
            : undefined
        }
      />

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
