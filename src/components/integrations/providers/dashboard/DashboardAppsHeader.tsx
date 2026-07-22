import { useLanguage } from '@/hooks/useLanguage';
import {
  Plus,
  Trash2,
} from 'lucide-react';
import { BaseHeader, HeaderAction } from '@/components/base';
import { usePermissions } from '@/contexts/PermissionsContext';
import { IntegrationBackButton } from '../../shared';

interface DashboardAppsHeaderProps {
  totalCount: number;
  selectedCount: number;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onNewApp: () => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
  onBack?: () => void;
}

export default function DashboardAppsHeader({
  totalCount,
  selectedCount,
  searchValue,
  onSearchChange,
  onNewApp,
  onBulkDelete,
  onClearSelection,
  onBack,
}: DashboardAppsHeaderProps) {
  const { t } = useLanguage('integrations');
  const { can, isReady } = usePermissions();

  const primaryAction: HeaderAction | undefined = isReady && can('dashboard_apps', 'create') ? {
    label: t('dashboardApps.header.newApp'),
    icon: <Plus className="h-4 w-4" />,
    onClick: onNewApp,
  } : undefined;

  const bulkActions: HeaderAction[] = isReady && can('dashboard_apps', 'delete') ? [
    {
      label: t('dashboardApps.header.delete'),
      icon: <Trash2 className="h-4 w-4" />,
      onClick: onBulkDelete,
      variant: 'destructive',
    },
  ] : [];

  return (
    <div>
      <IntegrationBackButton onBack={onBack} />
      
      <BaseHeader
        title={t('dashboardApps.title')}
        subtitle={t('dashboardApps.subtitle')}
        totalCount={totalCount}
        selectedCount={selectedCount}
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        searchPlaceholder={t('dashboardApps.header.searchPlaceholder')}
        primaryAction={primaryAction}
        bulkActions={bulkActions}
        showFilters={false}
        onClearSelection={onClearSelection}
      />
    </div>
  );
}