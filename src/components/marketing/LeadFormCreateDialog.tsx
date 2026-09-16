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
  Input,
  Label,
  Textarea,
  Checkbox,
  Switch,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
} from '@evoapi/design-system';
import { Plus, X } from 'lucide-react';
import { MetaPagePicker } from '@/components/marketing/MetaPagePicker';
import {
  metaCreationService,
  QUESTION_CATEGORIES,
  THANK_YOU_BUTTON_TYPES,
  type LeadQuestion,
  type LeadFormDetail,
} from '@/services/marketing/metaCreationService';

interface CustomQuestionDraft {
  label: string;
  multipleChoice: boolean;
  options: string[];
}

interface DuplicateContext {
  sourcePageId: string;
  formId: string;
  detail: LeadFormDetail;
}

interface LeadFormCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  defaultPage: { id: string; name: string } | null;
  duplicateFrom?: DuplicateContext | null;
}

function emptyCustomQuestion(): CustomQuestionDraft {
  return { label: '', multipleChoice: false, options: [''] };
}

export function LeadFormCreateDialog({
  open,
  onOpenChange,
  onSaved,
  defaultPage,
  duplicateFrom,
}: LeadFormCreateDialogProps) {
  const isDuplicate = Boolean(duplicateFrom);

  const [targetPage, setTargetPage] = useState<{ id: string; name: string } | null>(defaultPage);
  const [name, setName] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(['FULL_NAME', 'EMAIL', 'PHONE']));
  const [customQuestions, setCustomQuestions] = useState<CustomQuestionDraft[]>([]);

  const [greetingEnabled, setGreetingEnabled] = useState(false);
  const [greetingTitle, setGreetingTitle] = useState('');
  const [greetingDescription, setGreetingDescription] = useState('');
  const [greetingButtonText, setGreetingButtonText] = useState('Continuar');

  const [privacyUrl, setPrivacyUrl] = useState('');
  const [privacyLinkText, setPrivacyLinkText] = useState('');

  const [closingEnabled, setClosingEnabled] = useState(false);
  const [thankYouTitle, setThankYouTitle] = useState('');
  const [thankYouBody, setThankYouBody] = useState('');
  const [thankYouButtonType, setThankYouButtonType] = useState('VIEW_WEBSITE');
  const [thankYouButtonText, setThankYouButtonText] = useState('');
  const [thankYouWebsiteUrl, setThankYouWebsiteUrl] = useState('');

  const [saving, setSaving] = useState(false);

  // Pré-preenche quando é duplicação de um formulário existente.
  useEffect(() => {
    if (!open) return;
    setTargetPage(defaultPage);

    if (duplicateFrom) {
      const d = duplicateFrom.detail;
      setName(`${d.name} - Cópia`);
      const standardTypes = new Set<string>();
      const customs: CustomQuestionDraft[] = [];
      d.questions.forEach((q) => {
        if (q.type === 'CUSTOM') {
          customs.push({
            label: q.label || '',
            multipleChoice: Boolean(q.options?.length),
            options: q.options?.length ? q.options.map((o) => o.value) : [''],
          });
        } else {
          standardTypes.add(q.type);
        }
      });
      setSelectedTypes(standardTypes);
      setCustomQuestions(customs);

      const ctx = d.context_card;
      setGreetingEnabled(Boolean(ctx));
      setGreetingTitle(ctx?.title || '');
      setGreetingDescription(ctx?.content?.[0] || '');
      setGreetingButtonText(ctx?.button_text || 'Continuar');

      setPrivacyUrl(d.legal_content?.privacy_policy?.url || '');
      setPrivacyLinkText(d.legal_content?.privacy_policy?.link_text || '');

      const ty = d.thank_you_page;
      setClosingEnabled(Boolean(ty));
      setThankYouTitle(ty?.title || '');
      setThankYouBody(ty?.body || '');
      setThankYouButtonType(ty?.button_type || 'VIEW_WEBSITE');
      setThankYouButtonText(ty?.button_text || '');
      setThankYouWebsiteUrl(ty?.website_url || '');
    } else {
      setName('');
      setSelectedTypes(new Set(['FULL_NAME', 'EMAIL', 'PHONE']));
      setCustomQuestions([]);
      setGreetingEnabled(false);
      setGreetingTitle('');
      setGreetingDescription('');
      setGreetingButtonText('Continuar');
      setPrivacyUrl('');
      setPrivacyLinkText('');
      setClosingEnabled(false);
      setThankYouTitle('');
      setThankYouBody('');
      setThankYouButtonType('VIEW_WEBSITE');
      setThankYouButtonText('');
      setThankYouWebsiteUrl('');
    }
  }, [open, duplicateFrom, defaultPage]);

  const toggleType = (type: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const addCustomQuestion = () => setCustomQuestions((prev) => [...prev, emptyCustomQuestion()]);
  const removeCustomQuestion = (idx: number) =>
    setCustomQuestions((prev) => prev.filter((_, i) => i !== idx));
  const updateCustomQuestion = (idx: number, updates: Partial<CustomQuestionDraft>) =>
    setCustomQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...updates } : q)));

  const buildQuestions = (): LeadQuestion[] => {
    const questions: LeadQuestion[] = Array.from(selectedTypes).map((type) => ({ type }));
    customQuestions
      .filter((q) => q.label.trim())
      .forEach((q, idx) => {
        const key = `pergunta_${idx + 1}`;
        if (q.multipleChoice) {
          const options = q.options.filter((o) => o.trim());
          questions.push({
            type: 'CUSTOM',
            key,
            label: q.label.trim(),
            options: options.map((o, oi) => ({ key: `${key}_op${oi + 1}`, value: o.trim() })),
          });
        } else {
          questions.push({ type: 'CUSTOM', key, label: q.label.trim() });
        }
      });
    return questions;
  };

  const handleSubmit = async () => {
    if (!targetPage) {
      toast.error('Selecione a Página');
      return;
    }
    if (!name.trim()) {
      toast.error('Informe o nome do formulário');
      return;
    }
    const questions = buildQuestions();
    if (questions.length === 0) {
      toast.error('Selecione ao menos uma pergunta');
      return;
    }

    const payload = {
      name: name.trim(),
      questions,
      privacyPolicyUrl: privacyUrl.trim() || undefined,
      privacyPolicyLinkText: privacyLinkText.trim() || undefined,
      greetingTitle: greetingEnabled ? greetingTitle.trim() || undefined : undefined,
      greetingContent: greetingEnabled && greetingDescription.trim() ? [greetingDescription.trim()] : undefined,
      greetingButtonText: greetingEnabled ? greetingButtonText.trim() || undefined : undefined,
      thankYouTitle: closingEnabled ? thankYouTitle.trim() || undefined : undefined,
      thankYouBody: closingEnabled ? thankYouBody.trim() || undefined : undefined,
      thankYouButtonType: closingEnabled ? thankYouButtonType : undefined,
      thankYouButtonText: closingEnabled ? thankYouButtonText.trim() || undefined : undefined,
      thankYouWebsiteUrl: closingEnabled ? thankYouWebsiteUrl.trim() || undefined : undefined,
    };

    setSaving(true);
    try {
      if (duplicateFrom) {
        await metaCreationService.duplicateLeadForm({
          sourcePageId: duplicateFrom.sourcePageId,
          formId: duplicateFrom.formId,
          targetPageId: targetPage.id,
          overrides: payload,
        });
        toast.success('Formulário duplicado na Meta!');
      } else {
        await metaCreationService.createLeadForm({ pageId: targetPage.id, ...payload });
        toast.success('Formulário criado na Meta!');
      }
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error('Erro ao salvar o formulário na Meta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isDuplicate ? 'Duplicar formulário' : 'Novo formulário de lead (Instant Form)'}</DialogTitle>
          <DialogDescription>
            {isDuplicate
              ? 'Ajuste o que precisar e escolha em qual Página a cópia é criada.'
              : 'A Meta não permite editar um formulário depois de publicado — só o status (ativo/pausado). Pra mudanças, duplique e ajuste.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <MetaPagePicker onSelect={setTargetPage} />
            <span className="text-sm text-muted-foreground">
              {targetPage ? `Página: ${targetPage.name}` : 'Selecione a Página'}
            </span>
          </div>

          <div className="space-y-1.5">
            <Label>Nome do formulário</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Cadastro - Setembro" />
          </div>

          {/* Saudação */}
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Tela de saudação</Label>
              <Switch checked={greetingEnabled} onCheckedChange={setGreetingEnabled} />
            </div>
            {greetingEnabled && (
              <div className="space-y-2">
                <Input value={greetingTitle} onChange={(e) => setGreetingTitle(e.target.value)} placeholder="Título" />
                <Textarea
                  value={greetingDescription}
                  onChange={(e) => setGreetingDescription(e.target.value)}
                  placeholder="Descrição"
                  rows={2}
                />
                <Input
                  value={greetingButtonText}
                  onChange={(e) => setGreetingButtonText(e.target.value)}
                  placeholder="Texto do botão"
                />
              </div>
            )}
          </div>

          {/* Perguntas */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Perguntas</Label>
            {QUESTION_CATEGORIES.map((cat) => (
              <div key={cat.label} className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">{cat.label}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {cat.options.map((opt) => (
                    <label key={opt.type} className="flex items-center gap-1.5 text-sm">
                      <Checkbox
                        checked={selectedTypes.has(opt.type)}
                        onCheckedChange={() => toggleType(opt.type)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <p className="text-xs font-medium text-muted-foreground pt-1">Personalizadas</p>
            {customQuestions.map((q, idx) => (
              <div key={idx} className="border rounded-md p-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Input
                    value={q.label}
                    onChange={(e) => updateCustomQuestion(idx, { label: e.target.value })}
                    placeholder="Texto da pergunta"
                  />
                  <Button variant="ghost" size="icon" onClick={() => removeCustomQuestion(idx)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <label className="flex items-center gap-1.5 text-xs">
                  <Checkbox
                    checked={q.multipleChoice}
                    onCheckedChange={(c) => updateCustomQuestion(idx, { multipleChoice: Boolean(c) })}
                  />
                  Múltipla escolha
                </label>
                {q.multipleChoice && (
                  <div className="space-y-1 pl-4">
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-1.5">
                        <Input
                          value={opt}
                          onChange={(e) => {
                            const options = [...q.options];
                            options[oi] = e.target.value;
                            updateCustomQuestion(idx, { options });
                          }}
                          placeholder={`Opção ${oi + 1}`}
                          className="h-8 text-sm"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateCustomQuestion(idx, { options: q.options.filter((_, i) => i !== oi) })}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateCustomQuestion(idx, { options: [...q.options, ''] })}
                    >
                      <Plus className="w-3 h-3 mr-1" /> Opção
                    </Button>
                  </div>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addCustomQuestion}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Pergunta personalizada
            </Button>
          </div>

          {/* Política de privacidade */}
          <div className="space-y-1.5">
            <Label>URL da Política de Privacidade (opcional)</Label>
            <p className="text-xs text-muted-foreground">
              A Meta exige uma URL pra publicar o formulário — se deixar em branco, usamos a política da empresa
              cadastrada no sistema.
            </p>
            <Input value={privacyUrl} onChange={(e) => setPrivacyUrl(e.target.value)} placeholder="https://..." />
            <Input
              value={privacyLinkText}
              onChange={(e) => setPrivacyLinkText(e.target.value)}
              placeholder='Texto do link (padrão: "Política de Privacidade")'
            />
          </div>

          {/* Encerramento */}
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Tela de encerramento</Label>
              <Switch checked={closingEnabled} onCheckedChange={setClosingEnabled} />
            </div>
            {closingEnabled && (
              <div className="space-y-2">
                <Input value={thankYouTitle} onChange={(e) => setThankYouTitle(e.target.value)} placeholder="Título" />
                <Textarea
                  value={thankYouBody}
                  onChange={(e) => setThankYouBody(e.target.value)}
                  placeholder="Descrição"
                  rows={2}
                />
                <div className="space-y-1.5">
                  <Label className="text-xs">Ação adicional</Label>
                  <Select value={thankYouButtonType} onValueChange={setThankYouButtonType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {THANK_YOU_BUTTON_TYPES.map((b) => (
                        <SelectItem key={b.value} value={b.value}>
                          {b.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  value={thankYouButtonText}
                  onChange={(e) => setThankYouButtonText(e.target.value)}
                  placeholder="Texto do botão"
                />
                {thankYouButtonType !== 'NONE' && (
                  <Input
                    value={thankYouWebsiteUrl}
                    onChange={(e) => setThankYouWebsiteUrl(e.target.value)}
                    placeholder="URL de destino (site, WhatsApp, etc.)"
                  />
                )}
              </div>
            )}
          </div>

          {isDuplicate && (
            <Badge variant="outline" className="text-xs">
              Duplicando de: {duplicateFrom?.detail.name}
            </Badge>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Salvando...' : isDuplicate ? 'Criar cópia' : 'Criar formulário'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
