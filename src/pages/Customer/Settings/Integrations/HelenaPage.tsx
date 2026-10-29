import { useLanguage } from '@/hooks/useLanguage';
import { useNavigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import GenericIntegrationSettings from '@/components/integrations/providers/GenericIntegrationSettings';
import HelenaModal from '@/components/integrations/providers/helena/HelenaModal';

export default function HelenaPage() {
  const { t } = useLanguage('integrations');
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/settings/integrations');
  };

  return (
    <GenericIntegrationSettings
      appId="helena"
      displayName={t('providers.helena.name') || 'Helena (WTS)'}
      description={
        t('providers.helena.description') ||
        'Importa contatos com dados de origem de campanha (Meta/Instagram), exibidos em Marketing > Rastreamentos.'
      }
      icon={MessageSquare}
      configComponent={HelenaModal}
      onBack={handleBack}
    />
  );
}
