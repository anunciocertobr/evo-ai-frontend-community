import { useState } from 'react';
import { KeyRound, Loader2, ShieldAlert } from 'lucide-react';
import { Alert, AlertDescription, Button, Card, CardContent, Input, Label } from '@evoapi/design-system';

interface CourseUnlockGateProps {
  /** true = o aluno ainda não criou a senha. */
  configured: boolean;
  locked: boolean;
  failedAttempts?: number;
  onSetPassword: (password: string) => Promise<void>;
  onVerify: (password: string) => Promise<void>;
}

const MIN_PASSWORD = 6;

/**
 * Portão da área de cursos.
 *
 * A senha é do ALUNO e é separada do login do CRM (o usuário já está
 * autenticado aqui) — é a barreira que o usuário pediu para o conteúdo, não
 * autenticação. Por isso o backend não responde com `INVALID_CREDENTIALS` aqui:
 * esse código mata a sessão do CRM inteiro no interceptor do frontend.
 */
export const CourseUnlockGate = ({
  configured,
  locked,
  failedAttempts = 0,
  onSetPassword,
  onVerify,
}: CourseUnlockGateProps) => {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!configured) {
      if (password.length < MIN_PASSWORD) {
        setError(`A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`);
        return;
      }
      if (password !== confirmation) {
        setError('As senhas não são iguais.');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (configured) {
        await onVerify(password);
      } else {
        await onSetPassword(password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível continuar.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Área de cursos</h1>
              <p className="text-sm text-muted-foreground">
                {configured
                  ? 'Digite sua senha para ver seus cursos e continuar assistindo.'
                  : 'Crie uma senha para proteger sua área de cursos.'}
              </p>
            </div>
          </div>

          {locked && (
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription>
                Você errou a senha {failedAttempts} vezes. A área foi bloqueada por segurança.
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="course-unlock-password">{configured ? 'Senha' : 'Nova senha'}</Label>
              <Input
                id="course-unlock-password"
                type="password"
                autoComplete={configured ? 'current-password' : 'new-password'}
                value={password}
                onChange={event => setPassword(event.target.value)}
                disabled={locked || submitting}
                placeholder={configured ? '••••••••' : 'mínimo 6 caracteres'}
              />
            </div>

            {!configured && (
              <div className="space-y-1">
                <Label htmlFor="course-unlock-confirmation">Repetir a senha</Label>
                <Input
                  id="course-unlock-confirmation"
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={event => setConfirmation(event.target.value)}
                  disabled={submitting}
                />
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={locked || submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {configured ? 'Entrar' : 'Criar senha e entrar'}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground">
            Esta senha é diferente da senha do CRM e vale só para os cursos.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default CourseUnlockGate;