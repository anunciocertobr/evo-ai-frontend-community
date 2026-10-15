import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@evoapi/design-system';
import {
  googleAdsCreationService,
  type LeadFormCallToAction,
  type LeadFormPayload,
  type LeadFormQuestionField,
  type GoogleAdsAsset,
} from '@/services/marketing/googleAdsCreationService';

const CTA_LABEL: Record<LeadFormCallToAction, string> = {
  LEARN_MORE: 'Saiba mais',
  GET_QUOTE: 'Peça um orçamento',
  APPLY_NOW: 'Inscreva-se agora',
  SIGN_UP: 'Cadastre-se',
  CONTACT_US: 'Entre em contato',
  SUBSCRIBE: 'Assine',
  DOWNLOAD: 'Baixe',
  BOOK_NOW: 'Reserve agora',
  GET_OFFER: 'Receba a oferta',
  REGISTER: 'Registre-se',
};

const QUESTION_LABEL: Record<LeadFormQuestionField, string> = {
  FULL_NAME: 'Nome completo',
  EMAIL: 'E-mail',
  PHONE_NUMBER: 'Telefone',
  POSTAL_CODE: 'CEP',
  CITY: 'Cidade',
  REGION: 'Estado',
  COMPANY_NAME: 'Empresa',
  JOB_TITLE: 'Cargo',
};

const ALL_QUESTIONS = Object.keys(QUESTION_LABEL) as LeadFormQuestionField[];

interface GoogleAdsLeadFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  editing?: GoogleAdsAsset<LeadFormPayload> | null;
}

export function GoogleAdsLeadFormDialog({ open, onOpenChange, onSaved, editing }: GoogleAdsLeadFormDialogProps) {
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [headline, setHeadline] = useState('');
  const [description, setDescription] = useState('');
  const [callToAction, setCallToAction] = useState<LeadFormCallToAction>('GET_QUOTE');
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState('');
  const [questions, setQuestions] = useState<LeadFormQuestionField[]>(['FULL_NAME', 'PHONE_NUMBER']);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setBusinessName(editing?.payload.businessName ?? '');
    setHeadline(editing?.payload.headline ?? '');
    setDescription(editing?.payload.description ?? '');
    setCallToAction(editing?.payload.callToAction ?? 'GET_QUOTE');
    setPrivacyPolicyUrl(editing?.payload.privacyPolicyUrl ?? '');
    setQuestions(editing?.payload.questions ?? ['FULL_NAME', 'PHONE_NUMBER']);
  }, [open, editing]);

  const toggleQuestion = (field: LeadFormQuestionField) => {
    setQuestions((prev) => (prev.includes(field) ? prev.filter((q) => q !== field) : [...prev, field]));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Dê um nome pro formulário de lead.');
      return;
    }
    if (!businessName.trim() || !headline.trim() || !description.trim() || !privacyPolicyUrl.trim()) {
      toast.error('Preencha nome do negócio, título, descrição e URL da política de privacidade.');
      return;
    }
    if (questions.length === 0) {
      toast.error('Selecione pelo menos uma pergunta pro formulário.');
      return;
    }
    setSaving(true);
    try {
      const payload: LeadFormPayload = {
        businessName: businessName.trim(),
        headline: headline.trim(),
        description: description.trim(),
        callToAction,
        privacyPolicyUrl: privacyPolicyUrl.trim(),
        questions,
      };
      if (editing) {
        await googleAdsCreationService.update(editing.id, name.trim(), payload);
        toast.success('Formulário de lead atualizado');
      } else {
        await googleAdsCreationService.create('lead_form', name.trim(), payload);
        toast.success('Formulário de lead criado');
      }
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao salvar — confira se já não existe um formulário com esse nome.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar formulário de lead' : 'Novo formulário de lead'}</DialogTitle>
          <DialogDescription>
            Formulário nativo do Google Ads (Lead Form Extension) — a pessoa preenche sem sair do app/resultado de
            busca.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nome interno</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Lead Form - Orçamento" />
            </div>
            <div className="space-y-1.5">
              <Label>Nome do negócio</Label>
              <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Ex: Anuncio Certo" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Ex: Peça seu orçamento grátis" maxLength={30} />
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva a oferta em poucas linhas." rows={2} maxLength={200} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Chamada para ação</Label>
              <Select value={callToAction} onValueChange={(v) => setCallToAction(v as LeadFormCallToAction)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CTA_LABEL) as LeadFormCallToAction[]).map((cta) => (
                    <SelectItem key={cta} value={cta}>
                      {CTA_LABEL[cta]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>URL da política de privacidade</Label>
              <Input value={privacyPolicyUrl} onChange={(e) => setPrivacyPolicyUrl(e.target.value)} placeholder="https://seusite.com.br/privacidade" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Perguntas do formulário</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ALL_QUESTIONS.map((field) => (
                <label key={field} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={questions.includes(field)} onCheckedChange={() => toggleQuestion(field)} />
                  {QUESTION_LABEL[field]}
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
