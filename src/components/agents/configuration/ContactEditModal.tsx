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
      {/* `sm:max-w-*`/`sm:text-*` and not the plain utilities: tailwind-merge only cancels
          a responsive variant with another responsive variant. */}
      <DialogContent className="max-h-[90vh] gap-3 overflow-y-auto p-5 sm:max-w-[820px]">
        <DialogHeader className="sm:text-center">
          <DialogTitle className="text-xl font-bold text-foreground">
            Edição de Contatos
          </DialogTitle>
        </DialogHeader>
        <ContactEditRules config={config} onChange={onChange} />
      </DialogContent>
    </Dialog>
  );
};

export default ContactEditModal;
