import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@evoapi/design-system';
import { Network, Plus, Loader2 } from 'lucide-react';
import { MCPServerConfig } from '@/types/ai';
import { useState } from 'react';
import CustomMCPServersSection from '@/components/ai_agents/CustomMCPServersSection';
import CustomMCPDialog from '@/components/ai_agents/Dialogs/CustomMCPDialog';
import { MCPCard } from '@/components/integrations/MCPCard';
import { IntegrationDialogs } from '@/components/integrations/IntegrationDialogs';
import { useMCPIntegrations } from '@/hooks/useMCPIntegrations';
import { getAvailableMCPs } from '@/constants/mcpIntegrations';

interface MCPServersSectionProps {
  mcpServers: MCPServerConfig[];
  customMCPServerIds: string[];
  onMCPServersChange: (mcpServers: MCPServerConfig[]) => void;
  onCustomMCPServersChange: (serverIds: string[]) => void;
  agentId: string;
}

const MCPServersSection = ({
  mcpServers,
  customMCPServerIds,
  onMCPServersChange,
  onCustomMCPServersChange,
  agentId,
}: MCPServersSectionProps) => {
  const { t } = useLanguage('aiAgents');
  const [showCustomMcpPicker, setShowCustomMcpPicker] = useState(false);

  const addCustomMCPServers = (serverIds: string[]) => {
    const newIds = serverIds.filter(id => !customMCPServerIds.includes(id));
    onCustomMCPServersChange([...customMCPServerIds, ...newIds]);
  };

  // Dialog states
  const [showGitHubConfig, setShowGitHubConfig] = useState(false);
  const [showNotionConfig, setShowNotionConfig] = useState(false);
  const [showStripeConfig, setShowStripeConfig] = useState(false);
  const [showLinearConfig, setShowLinearConfig] = useState(false);
  const [showMondayConfig, setShowMondayConfig] = useState(false);
  const [showAtlassianConfig, setShowAtlassianConfig] = useState(false);
  const [showAsanaConfig, setShowAsanaConfig] = useState(false);
  const [showHubSpotConfig, setShowHubSpotConfig] = useState(false);
  const [showPayPalConfig, setShowPayPalConfig] = useState(false);
  const [showCanvaConfig, setShowCanvaConfig] = useState(false);
  const [showSupabaseConfig, setShowSupabaseConfig] = useState(false);

  // Use custom hook for integrations
  const {
    githubConfig,
    notionConfig,
    stripeConfig,
    linearConfig,
    mondayConfig,
    atlassianConfig,
    asanaConfig,
    hubspotConfig,
    paypalConfig,
    canvaConfig,
    supabaseConfig,
    available,
    isCheckingCredentials,
    reloadAllConfigs,
    isConnected,
  } = useMCPIntegrations(agentId);


  const availableMCPs = getAvailableMCPs(t);

  const isMCPEnabled = (mcpId: string): boolean => {
    return mcpServers.some(mcp => mcp.id === mcpId);
  };

  const toggleMCP = (mcpId: string) => {
    const isEnabled = isMCPEnabled(mcpId);
    if (isEnabled) {
      onMCPServersChange(mcpServers.filter(mcp => mcp.id !== mcpId));
    } else {
      const mcpInfo = availableMCPs.find(mcp => mcp.id === mcpId);
      const newMCP: MCPServerConfig = {
        id: mcpId,
        name: mcpInfo?.name || mcpId,
        type: 'standard',
        environments: {},
        tools: [],
      };
      onMCPServersChange([...mcpServers, newMCP]);
    }
  };

  const INTEGRATION_MCP_IDS = [
    'github',
    'notion',
    'stripe',
    'linear',
    'monday',
    'atlassian',
    'asana',
    'hubspot',
    'paypal',
    'canva',
    'supabase',
  ];

  const getDialogSetter = (mcpId: string): (() => void) | undefined => {
    const setters: Record<string, () => void> = {
      github: () => setShowGitHubConfig(true),
      notion: () => setShowNotionConfig(true),
      stripe: () => setShowStripeConfig(true),
      linear: () => setShowLinearConfig(true),
      monday: () => setShowMondayConfig(true),
      atlassian: () => setShowAtlassianConfig(true),
      asana: () => setShowAsanaConfig(true),
      hubspot: () => setShowHubSpotConfig(true),
      paypal: () => setShowPayPalConfig(true),
      canva: () => setShowCanvaConfig(true),
      supabase: () => setShowSupabaseConfig(true),
    };
    return setters[mcpId];
  };

  return (
    <div className="space-y-6">
      {/* MCPs Personalizados vêm PRIMEIRO: é o bloco acionável do agente. O
          catálogo de servidores prontos entra depois, como vitrine. */}
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button
            variant="outline"
            className="h-auto gap-2 rounded-[9px] border-[#E3E6EA] bg-white px-4 py-[9px] text-[13px] font-semibold text-[#1A211E]"
            onClick={() => setShowCustomMcpPicker(true)}
          >
            <Plus className="h-4 w-4" />
            {t('customMCPServers.add') || 'Adicionar Custom MCP'}
          </Button>
        </div>

        <CustomMCPServersSection
          customMCPServerIds={customMCPServerIds}
          onCustomMCPServersChange={onCustomMCPServersChange}
          isReadOnly={false}
          showAddButton={false}
          onAdd={() => setShowCustomMcpPicker(true)}
        />
      </div>

      {/* Seção: Servidores MCP prontos */}
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-blue-500/10">
            <Network className="h-[18px] w-[18px] text-blue-500" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-[#1A211E]">
              {t('edit.menu.mcpServers') || 'Servidores MCP'}
            </h3>
            <p className="mt-[3px] text-[13px] leading-[1.5] text-[#8A928F]">
              {t('mcpServers.subtitle') ||
                'Conecte o agente a serviços externos através do Model Context Protocol'}
            </p>
          </div>
        </div>

        <div>
          {isCheckingCredentials ? (
            <div className="flex flex-col gap-3 items-center py-12 h-32 text-muted-foreground">
              <Loader2 className="h-7 w-7 animate-spin" />
              <div className="text-sm">
                {t('mcpServers.checkingIntegrations') || 'Verificando integrações disponíveis...'}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {availableMCPs.map(mcp => {
                const isEnabled = isMCPEnabled(mcp.id);
                // DISPONIBILIDADE (CRM :3000 endpoint) — gates ATIVAR-disabled +
                // "Em breve"; distinct from per-agent "connected" (isConnected).
                const isConfigured = available[mcp.id] ?? false;
                const connected = isConnected(mcp.id);
                const onConfigure = getDialogSetter(mcp.id);
                const isIntegrationMCP = INTEGRATION_MCP_IDS.includes(mcp.id);

                return (
                  <MCPCard
                    key={mcp.id}
                    mcp={mcp}
                    isEnabled={isEnabled}
                    isConfigured={isConfigured}
                    isConnected={connected}
                    onToggle={!isIntegrationMCP ? () => toggleMCP(mcp.id) : undefined}
                    onConfigure={onConfigure}
                    showComingSoon={!isConfigured}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Picker de MCPs personalizados já cadastrados. `hideCreateNew` porque criar um
          novo MCP navega para fora de /agents/:id/edit e descartaria o form não salvo. */}
      <CustomMCPDialog
        open={showCustomMcpPicker}
        onOpenChange={setShowCustomMcpPicker}
        onSave={addCustomMCPServers}
        initialSelectedIds={customMCPServerIds}
        hideCreateNew
      />

      {/* Integration Dialogs */}
      <IntegrationDialogs
        agentId={agentId}
        mcpServers={mcpServers}
        onMCPServersChange={onMCPServersChange}
        onConfigReload={reloadAllConfigs}
        githubConfig={githubConfig}
        notionConfig={notionConfig}
        stripeConfig={stripeConfig}
        linearConfig={linearConfig}
        mondayConfig={mondayConfig}
        atlassianConfig={atlassianConfig}
        asanaConfig={asanaConfig}
        hubspotConfig={hubspotConfig}
        paypalConfig={paypalConfig}
        canvaConfig={canvaConfig}
        supabaseConfig={supabaseConfig}
        showGitHubConfig={showGitHubConfig}
        showNotionConfig={showNotionConfig}
        showStripeConfig={showStripeConfig}
        showLinearConfig={showLinearConfig}
        showMondayConfig={showMondayConfig}
        showAtlassianConfig={showAtlassianConfig}
        showAsanaConfig={showAsanaConfig}
        showHubSpotConfig={showHubSpotConfig}
        showPayPalConfig={showPayPalConfig}
        showCanvaConfig={showCanvaConfig}
        showSupabaseConfig={showSupabaseConfig}
        setShowGitHubConfig={setShowGitHubConfig}
        setShowNotionConfig={setShowNotionConfig}
        setShowStripeConfig={setShowStripeConfig}
        setShowLinearConfig={setShowLinearConfig}
        setShowMondayConfig={setShowMondayConfig}
        setShowAtlassianConfig={setShowAtlassianConfig}
        setShowAsanaConfig={setShowAsanaConfig}
        setShowHubSpotConfig={setShowHubSpotConfig}
        setShowPayPalConfig={setShowPayPalConfig}
        setShowCanvaConfig={setShowCanvaConfig}
        setShowSupabaseConfig={setShowSupabaseConfig}
      />
    </div>
  );
};

export default MCPServersSection;
