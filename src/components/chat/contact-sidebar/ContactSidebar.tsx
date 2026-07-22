import React, { useState, useEffect, useCallback, useRef } from 'react';

import { useLanguage } from '@/hooks/useLanguage';
import { toast } from 'sonner';

import { Button } from '@evoapi/design-system/button';
import { Card, CardHeader, CardContent } from '@evoapi/design-system/card';
import { Badge } from '@evoapi/design-system/badge';
import { X, User, ChevronDown, Info } from 'lucide-react';

import ContactHeader from './ContactHeader';
import ContactDetails from './ContactDetails';

import EditableConversationCustomAttributes from './EditableConversationCustomAttributes';

import { contactsService } from '@/services/contacts';
import { Contact, Conversation } from '@/types/chat/api';
import { mergeFullContact } from '@/utils/chat/contactTimestamp';

interface ContactSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  contact: Contact | null;
  conversation: Conversation | null;
  onFilterReload?: () => Promise<void>;
}

// Componente CollapsibleHeader igual ao usado em Agents.tsx
interface CollapsibleHeaderProps {
  title: string;
  description?: string;
  icon: React.ReactNode;
  count?: number;
  isOpen: boolean;
  onToggle: () => void;
}

const CollapsibleHeader = ({
  title,
  description,
  icon,
  count,
  isOpen,
  onToggle,
}: CollapsibleHeaderProps) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2 min-w-0 flex-1">
      {icon}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold truncate">{title}</h3>
          {count !== undefined && count > 0 && (
            <Badge variant="secondary" className="text-xs flex-shrink-0">
              {count}
            </Badge>
          )}
        </div>
        {description && <p className="text-xs text-muted-foreground truncate">{description}</p>}
      </div>
    </div>
    <Button variant="ghost" size="sm" onClick={onToggle} className="h-6 w-6 p-0 flex-shrink-0">
      <div className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>
        <ChevronDown className="h-3 w-3" />
      </div>
    </Button>
  </div>
);

const ContactSidebar: React.FC<ContactSidebarProps> = ({
  isOpen,
  onClose,
  contact,
  conversation,
  onFilterReload,
}) => {
  const { t } = useLanguage('chat');

  // Atributos da Conversa é a única seção colapsável (padrão Agents.tsx); os
  // Detalhes do Contato ficam sempre expandidos, seguindo o protótipo.
  const [showConversationAttributes, setShowConversationAttributes] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [enrichedContact, setEnrichedContact] = useState<Contact | null>(null);

  const contactRef = useRef(contact);
  useEffect(() => {
    contactRef.current = contact;
  });

  // Detectar se é mobile para controlar renderização
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    setEnrichedContact(null);
    if (!isOpen || !contact?.id) return;
    let cancelled = false;
    contactsService.getContact(contact.id, true).then(full => {
      if (cancelled) return;
      const base = contactRef.current ?? contact;
      setEnrichedContact(mergeFullContact(full as Contact, base));
    }).catch(err => {
      console.error('[ContactSidebar] Failed to fetch full contact data:', err);
    });
    return () => { cancelled = true; };
  // contactRef tracks the latest contact object; full `contact` excluded to avoid
  // re-fetching on every prop reference change — only re-fetch on id/open changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, contact?.id]);

  // Propagate scalar field changes from the contact prop into enrichedContact while
  // the sidebar is open — handles store/WebSocket updates with the same contact id.
  useEffect(() => {
    if (!isOpen || !contact) return;
    setEnrichedContact(prev => {
      if (!prev || prev.id !== contact.id) return prev;
      return {
        ...prev,
        name: contact.name ?? prev.name,
        phone_number: contact.phone_number ?? prev.phone_number,
        email: contact.email ?? prev.email,
        blocked: contact.blocked ?? prev.blocked,
        avatar_url: contact.avatar_url ?? prev.avatar_url,
        avatar: contact.avatar ?? prev.avatar,
        thumbnail: contact.thumbnail ?? prev.thumbnail,
      };
    });
  // Scalar fields used as deps intentionally instead of the full `contact` object
  // to avoid re-running on every reference change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, contact?.id, contact?.name, contact?.phone_number, contact?.email, contact?.blocked, contact?.avatar_url, contact?.avatar, contact?.thumbnail]);

  const handleContactAttributeUpdate = useCallback(async () => {
    const id = contactRef.current?.id;
    if (id) {
      try {
        const full = await contactsService.getContact(id, true);
        setEnrichedContact(prev => {
          const base = prev ?? contactRef.current;
          return base ? mergeFullContact(full as Contact, base) : null;
        });
      } catch (err) {
        console.error('[ContactSidebar] Failed to refresh contact after attribute update:', err);
        toast.error(t('contactSidebar.customAttributes.refreshError'));
      }
    }
    await onFilterReload?.();
  // t is stable (pure translation fn); omitted from deps intentionally.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFilterReload]);

  // No mobile, esconder completamente quando fechado
  // No desktop, manter no DOM para animação
  if (!isOpen && isMobile) return null;

  return (
    <>
      {/* Backdrop — flutua sobre o layout (desktop e mobile), igual ao protótipo */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
        border-l bg-background flex flex-col h-full
        fixed inset-0 md:inset-y-0 md:right-0 md:left-auto md:w-96 z-40
        transform transition-all duration-300 ease-in-out overflow-hidden
        ${isOpen
            ? 'w-full translate-x-0 md:opacity-100'
            : 'w-full translate-x-full md:opacity-0'
          }
      `}
      >
        {/* Header com Avatar e Info Básica + Close Button */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 relative">
          <ContactHeader contact={enrichedContact ?? contact} channelType={conversation?.inbox?.channel_type} />

          {/* Close Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="absolute top-4 right-4 h-8 w-8 p-0 hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Cards - Estrutura protótipo: Informações do Contato (fixo/expandido) + Atributos da Conversa (colapsável) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2 scrollbar-thin">
          {/* 1. Contact Details - card único, sempre expandido (sem chevron) */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <User className="h-4 w-4 text-green-500" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold truncate">
                    {t('contactSidebar.sections.contactDetails.title')}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {t('contactSidebar.sections.contactDetails.description')}
                  </p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-0 px-3 pb-3">
              <ContactDetails
                contact={enrichedContact ?? contact}
                onContactAttributeUpdate={handleContactAttributeUpdate}
              />
            </CardContent>
          </Card>

          {/* 2. Conversation Custom Attributes - Atributos personalizados da conversa */}
          {conversation && (
            <Card>
              <CardHeader className="pb-2">
                <CollapsibleHeader
                  title={t('contactSidebar.sections.conversationAttributes.title')}
                  description={t('contactSidebar.sections.conversationAttributes.description')}
                  icon={<Info className="h-4 w-4 text-cyan-500" />}
                  isOpen={showConversationAttributes}
                  onToggle={() => setShowConversationAttributes(!showConversationAttributes)}
                />
              </CardHeader>

              {showConversationAttributes && (
                <CardContent className="pt-0 px-3 pb-3">
                  <EditableConversationCustomAttributes
                    conversation={conversation}
                    onConversationUpdate={onFilterReload}
                  />
                </CardContent>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
};

export default ContactSidebar;
