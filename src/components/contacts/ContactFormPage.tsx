import { Button } from '@evoapi/design-system';
import { ArrowLeft, X } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import ContactDetailsCard from './ContactDetailsCard';
import type { ContactFormData } from '@/types/contacts';

interface ContactFormPageProps {
  loading?: boolean;
  onSubmit: (data: ContactFormData) => void | Promise<void>;
  onClose: () => void;
}

/** "/contacts/new" — full page hosting just the (empty, editable) Detalhes card, no
 *  Pipeline/Notas/Jornada columns (the prototype's Novo Contato has none of those —
 *  they only make sense once the contact exists). */
export default function ContactFormPage({ loading, onSubmit, onClose }: ContactFormPageProps) {
  const { t } = useLanguage('contacts');

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="sm" onClick={onClose} className="shrink-0">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('details.page.back')}
          </Button>
          <h1 className="text-base font-semibold truncate">{t('form.title.new')}</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label={t('details.page.close')}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto pt-4">
        <div className="max-w-2xl">
          <ContactDetailsCard isNew loading={loading} onSave={onSubmit} onCancelNew={onClose} />
        </div>
      </div>
    </div>
  );
}
