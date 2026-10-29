import { useState, useEffect } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
} from '@evoapi/design-system';
import { MessageSquare } from 'lucide-react';
import { IntegrationHook } from '@/types/integrations';

interface HelenaModalProps {
  hook?: IntegrationHook;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  isNew?: boolean;
  loading?: boolean;
}

// Formulário de 1 campo (token) — bem mais simples que BMSModal/LeadSquared
// porque a API WTS/Helena só pede um token de acesso, sem opções de sync.
// Salva como Integrations::Hook(app_id: 'helena', settings: {token}), lido
// de volta por Integrations::HelenaWts::BaseClient (ver comentário lá).
export default function HelenaModal({
  hook,
  open,
  onOpenChange,
  onSubmit,
  loading: submitting = false,
}: HelenaModalProps) {
  const { t } = useLanguage('integrations');
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setToken((hook?.settings?.token as string) || '');
    setError('');
  }, [hook, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token.trim()) {
      setError(t('helena.modal.fields.token.required') || 'Informe o token da API.');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({ token: token.trim() });
    } catch {
      // Erro já tratado pelo componente pai (GenericIntegrationSettings)
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            {hook ? (t('helena.modal.updateTitle') || 'Atualizar Helena (WTS)') : (t('helena.modal.title') || 'Conectar Helena (WTS)')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('helena.modal.description') ||
              'Cole o token de acesso da API WTS/Helena (api.wts.chat) pra importar contatos com dados de origem de campanha.'}
          </p>

          <div>
            <label htmlFor="helena_token" className="block text-sm font-medium mb-1">
              {t('helena.modal.fields.token.label') || 'Token da API'} *
            </label>
            <Input
              id="helena_token"
              type="password"
              placeholder={t('helena.modal.fields.token.placeholder') || 'Cole o token aqui'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className={error ? 'border-red-500' : ''}
            />
            {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('helena.modal.actions.cancel') || 'Cancelar'}
            </Button>
            <Button type="submit" disabled={loading || submitting}>
              {loading || submitting
                ? (t('helena.modal.actions.saving') || 'Salvando...')
                : hook
                  ? (t('helena.modal.actions.update') || 'Atualizar')
                  : (t('helena.modal.actions.configure') || 'Conectar')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
