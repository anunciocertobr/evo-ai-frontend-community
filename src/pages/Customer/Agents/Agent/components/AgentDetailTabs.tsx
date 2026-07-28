import { ReactNode } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@evoapi/design-system';
import { User, Wrench, Package, Settings, Radio } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import { AgentDetailTab, getVisibleAgentTabs } from './agentTabs';

interface AgentDetailTabsProps {
  agentType?: string;
  value: AgentDetailTab;
  onValueChange: (tab: AgentDetailTab) => void;
  children: ReactNode;
}

const AgentDetailTabs = ({ agentType, value, onValueChange, children }: AgentDetailTabsProps) => {
  const { t } = useLanguage('aiAgents');
  const visibleTabs = getVisibleAgentTabs(agentType);

  const tabConfig: Record<AgentDetailTab, { label: string; icon: typeof User }> = {
    profile: { label: t('edit.menu.profile') || 'Perfil', icon: User },
    tools: { label: t('edit.menu.tools') || 'Ferramentas', icon: Wrench },
    products: { label: t('edit.menu.products') || 'Produtos', icon: Package },
    configuration: { label: t('edit.menu.configuration') || 'Configuração', icon: Settings },
    channels: { label: t('edit.menu.channels') || 'Canais', icon: Radio },
  };

  return (
    <Tabs
      value={value}
      onValueChange={tab => onValueChange(tab as AgentDetailTab)}
      className="w-full"
    >
      <TabsList className="sticky top-0 z-10 h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b border-[#ECEEF2] bg-background p-0">
        {visibleTabs.map(tab => {
          const Icon = tabConfig[tab].icon;
          return (
            <TabsTrigger
              key={tab}
              value={tab}
              className="flex flex-shrink-0 items-center gap-2 rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-medium text-[#5B6470] shadow-none data-[state=active]:border-[#359558] data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-[#359558] data-[state=active]:shadow-none"
            >
              <Icon className="h-4 w-4" />
              {tabConfig[tab].label}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {children}
    </Tabs>
  );
};

export default AgentDetailTabs;
