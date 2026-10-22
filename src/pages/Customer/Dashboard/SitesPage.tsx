import { BaseHeader } from '@/components/base';
import { SitesTab } from './components/SitesTab';

// Dashboards > Sites — item próprio do menu lateral (separado de
// "Atendimentos"), não uma aba dentro do Dashboard principal.
export default function SitesPage() {
  return (
    <div className="h-full flex flex-col p-4 gap-6">
      <BaseHeader title="Sites" subtitle="Cards por site cadastrado, com webhook pra leads e e-commerce do Google Tag Manager." />
      <SitesTab />
    </div>
  );
}
