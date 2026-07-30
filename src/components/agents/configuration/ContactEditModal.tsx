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
      {/* `sm:max-w-*`/`sm:text-*`: a base do DialogContent traz `sm:max-w-lg` e a do
          DialogHeader `sm:text-left`. Sendo variantes responsivas, o tailwind-merge
          não as resolve contra `max-w-4xl`/`text-center` — o `sm:` do pacote vencia
          acima de 640px, e era daí que vinha o modal estreito com scroll.
          O `overflow-y-auto` fica como rede de segurança para telas baixas; no
          conteúdo compactado abaixo ele não chega a disparar. */}
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
