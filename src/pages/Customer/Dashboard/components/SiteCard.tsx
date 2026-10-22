import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@evoapi/design-system';
import { ListChecks, MoreVertical, Pencil, Send, Trash2 } from 'lucide-react';
import { getFaviconUrl } from '@/utils/sites/favicon';
import type { Site } from '@/services/sites/sitesService';

interface Props {
  site: Site;
  onViewLeads: (site: Site) => void;
  onConfigureWebhook: (site: Site) => void;
  onEdit: (site: Site) => void;
  onDelete: (site: Site) => void;
}

// Réplica do card de formulário em MetaCreationPage.tsx — mesma estrutura
// (rounded-lg border bg-card, título truncado + contagem, botão "Ver
// leads" primário + menu de ações), trocando favicon/URL por título+badge.
export function SiteCard({ site, onViewLeads, onConfigureWebhook, onEdit, onDelete }: Props) {
  const favicon = getFaviconUrl(site.hostname);

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {favicon && <img src={favicon} alt="" className="w-4 h-4 shrink-0" />}
          <h4 className="text-sm font-semibold truncate" title={site.url}>
            {site.name || site.hostname || site.url}
          </h4>
        </div>
      </div>
      <p className="text-xs text-muted-foreground truncate" title={site.url}>
        {site.url}
      </p>
      <p className="text-xs">
        <span className="font-medium">{site.leads_count}</span> leads recebidos
      </p>
      <div className="flex items-center gap-1.5 pt-1">
        <Button size="sm" variant="outline" className="flex-1 min-w-0" onClick={() => onViewLeads(site)}>
          <ListChecks className="w-3.5 h-3.5 mr-1 shrink-0" />
          <span className="truncate">Ver leads</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="outline">
              <MoreVertical className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onConfigureWebhook(site)}>
              <Send className="w-3.5 h-3.5 mr-2" /> Configurar Webhook
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(site)}>
              <Pencil className="w-3.5 h-3.5 mr-2" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(site)} className="text-destructive">
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
