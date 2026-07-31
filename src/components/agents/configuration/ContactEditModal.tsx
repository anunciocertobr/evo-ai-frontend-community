import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@evoapi/design-system';
import ContactEditRules, { ContactEditConfig } from '@/pages/Customer/Agents/Agent/sections/ContactEditRules';

interface ContactEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: ContactEditConfig;
  onChange: (config: ContactEditConfig) => void;
}

const ContactEditModal = ({ open, onOpenChange, config, onChange }: ContactEditModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* `sm:max-w-*`/`sm:text-*` e não os utilitários simples: variante responsiva
          do pacote não é cancelada por utilitário simples no tailwind-merge. */}
      <DialogContent className="max-h-[90vh] gap-3 overflow-y-auto p-5 sm:max-w-[820px]">
        <DialogHeader className="sm:text-center">
          <DialogTitle className="text-xl font-bold text-[#131917]">
            Edição de Contatos
          </DialogTitle>
        </DialogHeader>
        <ContactEditRules config={config} onChange={onChange} />
      </DialogContent>
    </Dialog>
  );
};

export default ContactEditModal;
