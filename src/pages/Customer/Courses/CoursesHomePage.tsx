import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Badge, Button, Card, CardContent, Input, Skeleton } from '@evoapi/design-system';
import coursesService from '@/services/courses';
import { EMPTY_COURSE_ROWS } from '@/services/courses/types';
import type { CourseCard as CourseCardType, CourseRows } from '@/services/courses/types';
import CourseRow from '@/components/courses/CourseRow';
import CourseUnlockGate from '@/components/courses/CourseUnlockGate';

const ROW_TITLES: Array<{ key: keyof CourseRows; title: string }> = [
  { key: 'continue_watching', title: 'Continuar assistindo' },
  { key: 'enrolled', title: 'Meus cursos' },
  { key: 'new', title: 'Novidades' },
  { key: 'trending', title: 'Mais procurados' },
  { key: 'free', title: 'Gratuitos' },
  { key: 'following', title: 'De criadores que você segue' },
  { key: 'wishlist', title: 'Na sua lista de desejos' },
  { key: 'completed', title: 'Concluídos' },
];

const UNLOCK_STORAGE_KEY = 'courses.unlock.token';

export const CoursesHomePage = () => {
  const navigate = useNavigate();

  const [rows, setRows] = useState<CourseRows>(EMPTY_COURSE_ROWS);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [unlockToken, setUnlockToken] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : window.localStorage.getItem(UNLOCK_STORAGE_KEY)
  );
  const [gate, setGate] = useState<{ configured: boolean; locked: boolean; failed_attempts: number } | null>(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await coursesService.rows());
    } catch {
      toast.error('Não foi possível carregar os cursos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const state = await coursesService.unlockState(unlockToken ?? undefined);
        if (cancelled) return;
        setGate(state.configured && !state.unlocked ? state : null);
      } catch {
        if (!cancelled) setGate(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [unlockToken]);

  const storeToken = (token: string) => {
    window.localStorage.setItem(UNLOCK_STORAGE_KEY, token);
    setUnlockToken(token);
    setGate(null);
  };

  const handleToggleWishlist = async (course: CourseCardType) => {
    try {
      if (course.viewer.wishlisted) {
        await coursesService.removeFromWishlist(course.slug);
        toast.success('Removido da lista de desejos.');
      } else {
        await coursesService.wishlist(course.slug);
        toast.success('Salvo na lista de desejos.');
      }
      await loadRows();
    } catch {
      toast.error('Não foi possível atualizar a lista de desejos.');
    }
  };

  if (gate) {
    return (
      <CourseUnlockGate
        configured={gate.configured}
        locked={gate.locked}
        failedAttempts={gate.failed_attempts}
        onVerify={async password => {
          const result = await coursesService.verifyPassword(password);
          storeToken(result.token);
          toast.success('Área de cursos liberada.');
        }}
        onSetPassword={async password => {
          await coursesService.setPassword(password);
          const result = await coursesService.verifyPassword(password);
          storeToken(result.token);
          toast.success('Senha criada. Bem-vindo à área de cursos!');
        }}
      />
    );
  }

  const hasAnyCourse = Object.values(rows).some(list => list.length > 0);

  return (
    <div className="flex min-h-full flex-col gap-6 bg-background p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <GraduationCap className="h-6 w-6" /> Cursos
          </h1>
          <p className="text-sm text-muted-foreground">Aprenda com os criadores da comunidade.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={event => setSearch(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && search.trim()) navigate(`/cursos/busca?q=${encodeURIComponent(search.trim())}`);
              }}
              placeholder="Buscar cursos"
              className="w-56 pl-8"
            />
          </div>
          <Button variant="outline" onClick={() => navigate('/criador/cursos')}>
            Sou criador
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-64 w-full" />
          ))}
        </div>
      ) : hasAnyCourse ? (
        <div className="flex flex-col gap-8">
          {ROW_TITLES.map(({ key, title }) => (
            <CourseRow key={key} title={title} courses={rows[key]} onToggleWishlist={handleToggleWishlist} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <Badge variant="secondary">Nenhum curso publicado ainda</Badge>
            <p className="max-w-md text-sm text-muted-foreground">
              Assim que o primeiro curso for publicado ele aparece aqui. Se você quer ensinar, publique o
              primeiro pela área do criador.
            </p>
            <Button onClick={() => navigate('/criador/cursos')}>Abrir área do criador</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CoursesHomePage;
