import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ListVideo, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Badge, Button, Progress } from '@evoapi/design-system';
import coursesService from '@/services/courses';
import type { CourseDetail, CourseLesson } from '@/services/courses/types';
import VideoPlayer from '@/components/courses/VideoPlayer';
import { formatDuration } from '@/components/courses/courseFormatters';

/** Heartbeat de progresso: o backend é idempotente, então repetir é seguro. */
const PROGRESS_HEARTBEAT_MS = 15_000;

export const LessonPlayerPage = () => {
  const { slug, lessonId } = useParams<{ slug: string; lessonId: string }>();
  const navigate = useNavigate();

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const lessons = useMemo<CourseLesson[]>(
    () => course?.modules.flatMap(module => module.lessons) ?? [],
    [course]
  );
  const lesson = lessons.find(item => item.id === lessonId) ?? null;
  const enrollmentId = course?.enrollment?.id ?? null;

  const load = useCallback(async () => {
    if (!slug) return;

    setLoading(true);
    try {
      setCourse(await coursesService.detail(slug));
    } catch {
      toast.error('Curso não encontrado.');
      navigate('/cursos');
    } finally {
      setLoading(false);
    }
  }, [slug, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveProgress = useCallback(
    async (seconds: number, completed: boolean) => {
      if (!enrollmentId || !lesson) return;

      try {
        await coursesService.saveProgress(enrollmentId, {
          lesson_id: lesson.id,
          position_seconds: seconds,
          completed,
        });

        // Recarregar só quando conclui: no heartbeat a cada 15s isso piscaria a
        // lista de aulas e atrapalharia quem está assistindo.
        if (completed) await load();
      } catch {
        toast.error('Não foi possível salvar o progresso.');
      }
    },
    [enrollmentId, lesson, load]
  );

  useEffect(() => {
    if (!enrollmentId || !lesson || lesson.locked) return undefined;

    const interval = setInterval(() => void saveProgress(PROGRESS_HEARTBEAT_MS, false), PROGRESS_HEARTBEAT_MS);
    return () => clearInterval(interval);
  }, [enrollmentId, lesson, saveProgress]);

  if (loading || !course) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentIndex = lessons.findIndex(item => item.id === lesson?.id);
  const nextLesson = currentIndex >= 0 ? lessons[currentIndex + 1] ?? null : null;

  return (
    <div className="flex min-h-full flex-col gap-4 bg-background p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => navigate(`/cursos/${course.slug}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para o curso
        </Button>

        {course.enrollment && (
          <div className="flex w-56 items-center gap-2">
            <Progress value={course.enrollment.progress_percent} className="h-2" />
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {Math.round(course.enrollment.progress_percent)}%
            </span>
          </div>
        )}
      </div>

      {lesson ? (
        <VideoPlayer
          embedUrl={lesson.embed_url}
          title={lesson.title}
          onTimeUpdate={seconds => void saveProgress(seconds, false)}
          onEnded={() => {
            void saveProgress(0, true);
            if (nextLesson) navigate(`/cursos/${course.slug}/aula/${nextLesson.id}`);
          }}
        />
      ) : (
        <div className="flex aspect-video items-center justify-center rounded-lg bg-muted">
          <p className="text-sm text-muted-foreground">Escolha uma aula na lista.</p>
        </div>
      )}

      {lesson && (
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">{lesson.title}</h1>
          {lesson.description && <p className="text-sm text-muted-foreground">{lesson.description}</p>}
          <div className="flex items-center gap-2">
            {lesson.is_preview && <Badge variant="outline">Prévia gratuita</Badge>}
            {lesson.locked && <Badge variant="secondary">Bloqueada</Badge>}
            <span className="text-xs text-muted-foreground">{formatDuration(lesson.duration_seconds)}</span>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <ListVideo className="h-4 w-4" />
          <h2 className="text-sm font-semibold">Aulas do curso</h2>
        </div>

        <ol className="divide-y divide-border">
          {lessons.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => navigate(`/cursos/${course.slug}/aula/${item.id}`)}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted ${
                  item.id === lesson?.id ? 'bg-muted font-medium' : ''
                }`}
              >
                <span className="w-6 shrink-0 text-xs text-muted-foreground">{index + 1}</span>
                {item.locked ? (
                  <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <CheckCircle2
                    className={`h-3.5 w-3.5 shrink-0 ${
                      currentIndex > index ? 'text-green-600' : 'text-muted-foreground'
                    }`}
                  />
                )}
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDuration(item.duration_seconds)}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
};

export default LessonPlayerPage;