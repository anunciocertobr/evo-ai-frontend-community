import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
  Textarea,
  Checkbox,
} from '@evoapi/design-system';
import { Plus, X } from 'lucide-react';
import { metaCreationService, type LeadQuestion } from '@/services/marketing/metaCreationService';

interface LeadFormCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function LeadFormCreateDialog({ open, onOpenChange, onCreated }: LeadFormCreateDialogProps) {
  const [name, setName] = useState('');
  const [askName, setAskName] = useState(true);
  const [askEmail, setAskEmail] = useState(true);
  const [askPhone, setAskPhone] = useState(true);
  const [customQuestions, setCustomQuestions] = useState<string[]>([]);
  const [privacyUrl, setPrivacyUrl] = useState('');
  const [thankYouTitle, setThankYouTitle] = useState('');
  const [thankYouBody, setThankYouBody] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName('');
    setAskName(true);
    setAskEmail(true);
    setAskPhone(true);
    setCustomQuestions([]);
    setPrivacyUrl('');
    setThankYouTitle('');
    setThankYouBody('');
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Informe o nome do formulário');
      return;
    }
    if (!privacyUrl.trim()) {
      toast.error('Informe a URL da política de privacidade');
      return;
    }
    const questions: LeadQuestion[] = [];
    if (askName) questions.push({ type: 'FULL_NAME' });
    if (askEmail) questions.push({ type: 'EMAIL' });
    if (askPhone) questions.push({ type: 'PHONE' });
    customQuestions
      .filter((q) => q.trim())
      .forEach((label, idx) => questions.push({ type: 'CUSTOM', key: `pergunta_${idx + 1}`, label }));

    if (questions.length === 0) {
      toast.error('Selecione ao menos uma pergunta');
      return;
    }

    setSaving(true);
    try {
      await metaCreationService.createLeadForm({
        name: name.trim(),
        questions,
        privacy_policy_url: privacyUrl.trim(),
        thank_you_title: thankYouTitle.trim() || undefined,
        thank_you_body: thankYouBody.trim() || undefined,
      });
      toast.success('Formulário criado na Meta!');
      reset();
      onOpenChange(false);
      onCreated();
    } catch {
      toast.error('Erro ao criar o formulário na Meta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo formulário de lead (Instant Form)</DialogTitle>
          <DialogDescription>
            Cria um formulário de cadastro na Página do Facebook conectada, pronto pra usar em
            campanhas de Geração de Leads.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome do formulário</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Cadastro - Setembro" />
          </div>

          <div className="space-y-1.5">
            <Label>Perguntas</Label>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={askName} onCheckedChange={(c) => setAskName(Boolean(c))} /> Nome completo
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={askEmail} onCheckedChange={(c) => setAskEmail(Boolean(c))} /> Email
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={askPhone} onCheckedChange={(c) => setAskPhone(Boolean(c))} /> Telefone
              </label>
            </div>
            {customQuestions.map((q, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  value={q}
                  onChange={(e) =>
                    setCustomQuestions((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))
                  }
                  placeholder="Texto da pergunta personalizada"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCustomQuestions((prev) => prev.filter((_, i) => i !== idx))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setCustomQuestions((prev) => [...prev, ''])}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Pergunta personalizada
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label>URL da Política de Privacidade</Label>
            <Input
              value={privacyUrl}
              onChange={(e) => setPrivacyUrl(e.target.value)}
              placeholder="https://seusite.com/privacidade"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Mensagem de agradecimento (opcional)</Label>
            <Input
              value={thankYouTitle}
              onChange={(e) => setThankYouTitle(e.target.value)}
              placeholder="Título (ex: Recebemos seu contato!)"
            />
            <Textarea
              value={thankYouBody}
              onChange={(e) => setThankYouBody(e.target.value)}
              placeholder="Texto exibido depois do envio"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Criando...' : 'Criar formulário'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
