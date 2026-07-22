import React from 'react';
import { CheckCircle, Clock, MessageCircle, Pause } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@evoapi/design-system/tooltip';
import { useLanguage } from '@/hooks/useLanguage';
import { getStatusConfig } from '@/utils/chat/conversationStatus';

interface ConversationStatusIconProps {
  status: string;
  size?: 'sm' | 'md';
}

const STATUS_ICONS: Record<string, typeof MessageCircle> = {
  open: MessageCircle,
  pending: Clock,
  resolved: CheckCircle,
  snoozed: Pause,
};

const ConversationStatusIcon: React.FC<ConversationStatusIconProps> = ({ status, size = 'sm' }) => {
  const { t } = useLanguage('chat');

  const config = getStatusConfig(status, t);
  const Icon = STATUS_ICONS[status] || MessageCircle;

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const containerSize = size === 'sm' ? 'w-5 h-5' : 'w-6 h-6';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`
              ${containerSize} rounded-full ${config.bgColor}
              flex items-center justify-center cursor-help
              hover:scale-110 transition-transform duration-200
            `}
          >
            <Icon className={`${iconSize} ${config.color}`} />
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="px-3 py-2 bg-popover border border-border shadow-lg rounded-lg"
        >
          <div className="text-center">
            <div className="text-sm font-semibold text-foreground">{config.label}</div>
            <div className="text-xs text-muted-foreground mt-1">{config.description}</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ConversationStatusIcon;
