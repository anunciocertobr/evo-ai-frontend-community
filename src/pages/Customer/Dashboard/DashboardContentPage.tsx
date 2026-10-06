import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@evoapi/design-system';
import { DASHBOARD_DEFAULT_HREF, findDashboardItem } from '@/utils/dashboardMenu';
import { ContentViewer } from '@/components/content/ContentViewer';
import ReportLinksManager from '@/components/marketing/ReportLinksManager';

/** Exibe o conteúdo de um item personalizado do submenu Dashboard. */
export default function DashboardContentPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const item = useMemo(() => (itemId ? findDashboardItem(itemId) : null), [itemId]);

  if (!item) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-muted-foreground">Conteúdo não encontrado.</p>
        <Button variant="outline" asChild>
          <Link to={DASHBOARD_DEFAULT_HREF}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao Dashboard
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* O botão vai na barra do título (headerActions), e não dentro do
          conteúdo: o HTML dos itens do submenu Dashboard é salvo por usuário e
          editável à mão — um botão injetado nele sumiria na primeira edição. */}
      <ContentViewer
        headerActions={<ReportLinksManager reportType="ads_reports" defaultTitle={item.title} />}
        backHref={DASHBOARD_DEFAULT_HREF}
        backLabel="Voltar ao Dashboard"
        title={item.title}
        subtitle="Item personalizado do Dashboard"
        contentType={item.contentType}
        url={item.url}
        html={item.html}
        fileName={item.fileName}
        fileData={item.fileData}
      />
    </>
  );
}
