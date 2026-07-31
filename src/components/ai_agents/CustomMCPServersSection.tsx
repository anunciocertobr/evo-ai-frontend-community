import { useState } from 'react';
import {
  Button,
  Badge,
  } from '@evoapi/design-system';
import {
  ExternalLink,
  Plus,
  Server,
  X,
} from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import CustomMCPDialog from './Dialogs/CustomMCPDialog';

interface CustomMCPServersSectionProps {
  customMCPServerIds: string[];
  onCustomMCPServersChange: (serverIds: string[]) => void;
  isReadOnly?: boolean;
  /** Quando o caller já expõe o próprio botão "Adicionar Custom MCP" para a LISTA. */
  showAddButton?: boolean;
  hideCreateNew?: boolean;
  /** Deixa o CTA do estado vazio abrir o picker do caller em vez do diálogo local. */
  onAdd?: () => void;
}

const CustomMCPServersSection = ({
  customMCPServerIds,
  onCustomMCPServersChange,
  isReadOnly = false,
  showAddButton = true,
  hideCreateNew = false,
  onAdd,
}: CustomMCPServersSectionProps) => {
  const { t } = useLanguage('aiAgents');
  const [showCustomMCPDialog, setShowCustomMCPDialog] = useState(false);

  // O picker abre com a seleção atual já marcada, então o que ele devolve É a
  // seleção — unir com a anterior faria desmarcar não ter efeito nenhum.
  const handleAddCustomMCPServers = (serverIds: string[]) => {
    onCustomMCPServersChange(serverIds);
  };

  const handleRemoveCustomMCPServer = (serverId: string) => {
    const updatedIds = customMCPServerIds.filter(id => id !== serverId);
    onCustomMCPServersChange(updatedIds);
  };

  return (
    <div className="space-y-4">
      {customMCPServerIds && customMCPServerIds.length > 0 ? (
            <div className="space-y-3">
              {customMCPServerIds.map(serverId => (
                <div
                  key={`referenced-${serverId}`}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <ExternalLink className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">{serverId}</span>
                      <Badge
                        variant="outline"
                        className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                      >
                        {t('tools.mcpServers.referenced')}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t('tools.mcpServers.externallyManaged')}
                    </p>
                  </div>
                  {/* Remover não depende de `showAddButton`: ele esconde só os CTAs de adicionar. */}
                  {!isReadOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveCustomMCPServer(serverId)}
                      aria-label={t('actions.remove') || 'Remover'}
                      className="text-destructive hover:text-destructive/80"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}

              {!isReadOnly && showAddButton && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCustomMCPDialog(true)}
                  className="w-full mt-2"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t('tools.mcpServers.addCustom')}
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center rounded-[12px] border border-dashed border-[#E3E6EA] px-6 py-12 text-center">
              <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-[12px] bg-[#F0FAF4]">
                <Server className="h-6 w-6 text-[#359558]" />
              </span>
              <p className="text-[15px] font-bold text-[#1A211E]">
                {t('tools.mcpServers.noCustomConfigured')}
              </p>
              <p className="mt-1 max-w-md text-[13px] leading-[1.5] text-[#8A928F]">
                {t('tools.mcpServers.connectFromManagement')}
              </p>
              {/* Idem: um estado vazio sem ação seria beco sem saída. */}
              {!isReadOnly && (
                <Button
                  type="button"
                  onClick={() => (onAdd ? onAdd() : setShowCustomMCPDialog(true))}
                  className="mt-5 h-auto gap-2 rounded-[9px] bg-[#359558] px-5 py-[10px] text-sm font-semibold text-white hover:bg-[#2C834E]"
                >
                  <Plus className="h-4 w-4" />
                  {t('customMCPServers.add') || 'Adicionar Custom MCP'}
                </Button>
              )}
            </div>
          )}

      <CustomMCPDialog
        open={showCustomMCPDialog}
        onOpenChange={setShowCustomMCPDialog}
        onSave={handleAddCustomMCPServers}
        initialSelectedIds={customMCPServerIds}
        hideCreateNew={hideCreateNew}
      />
    </div>
  );
};

export default CustomMCPServersSection;
