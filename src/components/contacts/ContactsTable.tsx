import { useLanguage } from '@/hooks/useLanguage';
import { MessageSquare, Edit, Trash, Users, Lock } from 'lucide-react';
import { Button } from '@evoapi/design-system';
import { Contact } from '@/types/contacts';
import { BaseTable, TableColumn, TableAction } from '@/components/base';
import ContactAvatar from '@/components/chat/contact/ContactAvatar';
import { useContactPiiMasking } from '@/hooks/useContactPiiMasking';
import ContactStatusBadge from './ContactStatusBadge';
import ContactTagsList from './ContactTagsList';
import ContactTypeBadge from './ContactTypeBadge';
import ContactPipelinesBadge from './ContactPipelinesBadge';

interface ContactsTableProps {
  contacts: Contact[];
  selectedContacts: Contact[];
  loading?: boolean;
  onSelectionChange: (contacts: Contact[]) => void;
  onContactClick: (contact: Contact) => void;
  onStartConversation: (contact: Contact) => void;
  onEditContact: (contact: Contact) => void;
  onDeleteContact?: (contact: Contact) => void;
  onCreateContact?: () => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (column: string) => void;
  // Colunas extras (pedido do CRM + pixel Meta), ligadas/desligadas pelo
  // botão "Colunas" na tela — ver EXTRA_COLUMN_DEFS/CONTACTS_EXTRA_COLUMNS
  // abaixo, mesmo padrão do botão "Colunas" de SiteLeadsDialog.
  visibleExtraColumns?: Set<string>;
}

const dash = (value: string | number | null | undefined) => (value === null || value === undefined || value === '' ? '-' : value);

export default function ContactsTable({
  contacts,
  selectedContacts,
  loading,
  onSelectionChange,
  onContactClick,
  onStartConversation,
  onEditContact,
  onDeleteContact,
  onCreateContact,
  sortBy,
  sortOrder,
  onSort,
  visibleExtraColumns,
}: ContactsTableProps) {
  const { t } = useLanguage('contacts');
  const { shouldMask, maskPhone, maskEmail } = useContactPiiMasking();
  const protectedTitle = shouldMask ? t('card.dataProtectedTooltip') : undefined;
  const contactsList = contacts || [];

  // Agrega os "pedidos" (PipelineItem) do contato numa única célula por
  // coluna — um contato pode ter mais de um (um por pipeline/Kanban em
  // que entrou). order_id = o id do próprio PipelineItem (não existe um
  // model "Order" separado neste CRM).
  const pedidoResumo = (contact: Contact) => {
    const items = (contact.pipelines || []).map((p) => p.item).filter((i) => (i.products_total || 0) > 0 || (i.products && i.products.length > 0));
    const orderIds = items.map((i) => i.id).filter(Boolean);
    const produtos = Array.from(new Set(items.flatMap((i) => (i.products || []).map((p) => p.name).filter(Boolean)))) as string[];
    const valorTotal = items.reduce((sum, i) => sum + (i.products_total || 0), 0);
    return { orderIds, produtos, valorTotal };
  };

  // const formatLastActivity = (date: string) => {
  //   if (!date) return 'Nunca';
  //   try {
  //     return formatDistanceToNow(new Date(date), {
  //       addSuffix: true,
  //       locale: ptBR,
  //     });
  //   } catch {
  //     return 'Data inválida';
  //   }
  // };

  const columns: TableColumn<Contact>[] = [
    {
      key: 'name',
      label: t('table.columns.name'),
      sortable: true,
      width: 'w-56',
      render: contact => (
        <div
          className="flex items-center gap-3 cursor-pointer hover:opacity-80 py-2"
          onClick={() => onContactClick(contact)}
        >
          <ContactAvatar contact={contact} size="md" showColoredFallback={true} />
          <div className="min-w-0 flex-1 font-medium text-sm break-words">
            {contact.name || t('table.noName')}
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      label: t('table.columns.email'),
      sortable: true,
      width: 'w-48',
      render: contact =>
        contact.email ? (
          <span className="truncate flex items-center gap-1 text-sm" title={protectedTitle}>
            {shouldMask && <Lock className="h-3 w-3 flex-shrink-0" aria-label={protectedTitle} />}
            {maskEmail(contact.email)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'phone_number',
      label: t('table.columns.phone'),
      sortable: true,
      width: 'w-40',
      render: contact =>
        contact.phone_number ? (
          <span className="whitespace-nowrap flex items-center gap-1 text-sm" title={protectedTitle}>
            {shouldMask && <Lock className="h-3 w-3 flex-shrink-0" aria-label={protectedTitle} />}
            {maskPhone(contact.phone_number)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'type',
      label: t('table.columns.type'),
      sortable: false,
      render: contact => (
        <ContactTypeBadge type={contact.type || 'person'} className="justify-center" />
      ),
    },
    {
      key: 'labels',
      label: t('table.columns.labels'),
      sortable: false,
      render: contact => <ContactTagsList labels={contact.labels} maxVisible={3} size="sm" />,
    },
    {
      key: 'pipelines',
      label: t('table.columns.pipelines'),
      sortable: false,
      render: contact =>
        contact.pipelines && contact.pipelines.length > 0 ? (
          <ContactPipelinesBadge contact={contact} maxPipelines={2} compact={true} />
        ) : null,
    },
    {
      key: 'status',
      label: t('table.columns.status'),
      sortable: false,
      render: contact => <ContactStatusBadge blocked={contact.blocked} />,
    },
    ...(visibleExtraColumns?.has('pedido_order_id')
      ? [{ key: 'pedido_order_id', label: 'Order ID (pedido)', sortable: false, render: (contact: Contact) => <span className="font-mono text-xs">{dash(pedidoResumo(contact).orderIds.join(', '))}</span> }]
      : []),
    ...(visibleExtraColumns?.has('pedido_produtos')
      ? [{ key: 'pedido_produtos', label: 'Produtos', sortable: false, render: (contact: Contact) => <span className="max-w-[200px] inline-block truncate align-bottom">{dash(pedidoResumo(contact).produtos.join(', '))}</span> }]
      : []),
    ...(visibleExtraColumns?.has('pedido_valor')
      ? [{ key: 'pedido_valor', label: 'Valor do pedido', sortable: false, render: (contact: Contact) => { const v = pedidoResumo(contact).valorTotal; return <span>{v > 0 ? `R$ ${v.toFixed(2)}` : '-'}</span>; } }]
      : []),
    ...(visibleExtraColumns?.has('pixel_campanha')
      ? [{ key: 'pixel_campanha', label: 'Campanha (pixel)', sortable: false, render: (contact: Contact) => dash(contact.ad_lead?.campaign_name) }]
      : []),
    ...(visibleExtraColumns?.has('pixel_conjunto')
      ? [{ key: 'pixel_conjunto', label: 'Conjunto (pixel)', sortable: false, render: (contact: Contact) => dash(contact.ad_lead?.adset_name) }]
      : []),
    ...(visibleExtraColumns?.has('pixel_anuncio')
      ? [{ key: 'pixel_anuncio', label: 'Anúncio (pixel)', sortable: false, render: (contact: Contact) => dash(contact.ad_lead?.ad_name) }]
      : []),
    ...(visibleExtraColumns?.has('pixel_utm_source')
      ? [{ key: 'pixel_utm_source', label: 'UTM Source (pixel)', sortable: false, render: (contact: Contact) => dash(contact.ad_lead?.utm_source) }]
      : []),
    ...(visibleExtraColumns?.has('pixel_valor_venda')
      ? [{ key: 'pixel_valor_venda', label: 'Valor venda (pixel)', sortable: false, render: (contact: Contact) => { const v = contact.ad_lead?.valor_venda; return <span>{v ? `R$ ${Number(v).toFixed(2)}` : '-'}</span>; } }]
      : []),
    {
      key: 'startConversation',
      label: '',
      sortable: false,
      align: 'center',
      width: 'w-10',
      render: contact =>
        !contact.blocked ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={e => {
              e.stopPropagation();
              onStartConversation(contact);
            }}
            title={t('table.actions.startConversation')}
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
        ) : null,
    },
  ];

  const actions: TableAction<Contact>[] = [
    {
      label: t('table.actions.edit'),
      icon: <Edit className="h-4 w-4" />,
      onClick: onEditContact,
    },
    ...(onDeleteContact
      ? [
          {
            label: t('table.actions.delete'),
            icon: <Trash className="h-4 w-4" />,
            onClick: onDeleteContact,
            variant: 'destructive' as const,
          },
        ]
      : []),
  ];

  return (
    <BaseTable<Contact>
      data={contactsList}
      columns={columns}
      actions={actions}
      selectable
      selectedItems={selectedContacts}
      onSelectionChange={onSelectionChange}
      sortBy={sortBy}
      sortOrder={sortOrder}
      onSort={onSort}
      loading={loading}
      emptyMessage={t('table.empty.noResults')}
      emptyIcon={Users}
      emptyTitle={t('table.empty.title')}
      emptyDescription={t('table.empty.description')}
      emptyAction={
        onCreateContact
          ? {
              label: t('table.actions.create'),
              onClick: onCreateContact,
            }
          : undefined
      }
      getRowKey={contact => String(contact.id)}
      className="border-0 shadow-none"
      stickyHorizontalScroll
    />
  );
}
