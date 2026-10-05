import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Heart,
  Loader2,
  Lock,
  PlayCircle,
  Star,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage, Badge, Button, Card, CardContent, Separator } from '@evoapi/design-system';
import coursesService from '@/services/courses';
import type { CourseDetail } from '@/services/courses/types';
import VideoPlayer from '@/components/courses/VideoPlayer';
import { formatDuration, formatStudents, initialsOf, LEVEL_LABELS } from '@/components/courses/courseFormatters';

export const CourseDetailPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!slug) return;

    setLoading(true);
    try {
      const data = await coursesService.detail(slug);
      setCourse(data);

      // Abrir direto na aula de "continuar assistindo" vale mais que recomeçar
      // do zero toda vez que o aluno volta ao curso.
      const resumeId = data.enrollment?.last_lesson_id ?? firstPlayableLessonId(data);
      setSelectedLessonId(resumeId);
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

  const handleEnroll = async () => {
    if (!course) return;

    setEnrolling(true);
    try {
      const result = await coursesService.enroll(course.slug);

      if (result.kind === 'enrolled') {
        toast.success('Inscrição feita. Bom estudo!');
      } else {
        toast.success('Pedido enviado. O vendedor precisa aprovar o seu acesso.');
      }

      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível se inscrever.');
    } finally {
      setEnrolling(false);
    }
  };

  const handleToggleWishlist = async () => {
    if (!course) return;

    try {
      if (course.viewer.wishlisted) {
        await coursesService.removeFromWishlist(course.slug);
        toast.success('Removido da lista de desejos.');
      } else {
        await coursesService.wishlist(course.slug);
        toast.success('Salvo na lista de desejos.');
      }
      await load();
    } catch {
      toast.error('Não foi possível atualizar a lista de desejos.');
    }
  };

  if (loading || !course) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectedLesson = findLesson(course, selectedLessonId);

  return (
    <div className="flex min-h-full flex-col gap-6 bg-background p-6">
      <Button variant="ghost" className="w-fit" onClick={() => navigate('/cursos')}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para os cursos
      </Button>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          <Card className="overflow-hidden">
            {selectedLesson ? (
              <VideoPlayer
                embedUrl={selectedLesson.embed_url}
                title={selectedLesson.title}
                autoStart
                onEnded={() => toast.success('Aula concluída!')}
              />
            ) : (
              <div className="flex aspect-video items-center justify-center bg-muted">
                <p className="text-sm text-muted-foreground">Escolha uma aula para começar.</p>
              </div>
            )}

            <CardContent className="space-y-3 p-5">
              {selectedLesson && (
                <div>
                  <h2 className="text-lg font-semibold">{selectedLesson.title}</h2>
                  {selectedLesson.description && (
                    <p className="text-sm text-muted-foreground">{selectedLesson.description}</p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {course.free ? <Badge>Gratuito</Badge> : <Badge>{course.price_formatted}</Badge>}
                <Badge variant="secondary">{LEVEL_LABELS[course.level]}</Badge>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <PlayCircle className="h-3.5 w-3.5" /> {course.lessons_count} aulas
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> {formatDuration(course.duration_seconds)}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> {formatStudents(course.students_count)}
                </span>
                {course.rating_count > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {course.rating_average.toFixed(1)}
                  </span>
                )}
              </div>

              <Separator />

              <div className="flex flex-wrap items-center gap-2">
                {course.enrolled ? (
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Você está inscrito
                  </Badge>
                ) : course.viewer.purchase_pending ? (
                  <Badge variant="outline">Pedido enviado — aguardando o vendedor</Badge>
                ) : (
                  <Button onClick={handleEnroll} disabled={enrolling}>
                    {enrolling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {course.free ? 'Começar agora' : `Pedir acesso · ${course.price_formatted}`}
                  </Button>
                )}

                <Button variant="outline" onClick={handleToggleWishlist}>
                  <Heart className={course.viewer.wishlisted ? 'mr-2 h-4 w-4 fill-red-500 text-red-500' : 'mr-2 h-4 w-4'} />
                  {course.viewer.wishlisted ? 'Na lista' : 'Lista de desejos'}
                </Button>
              </div>

              {!course.enrolled && course.paid && course.creator?.pix_key && (
                <p className="text-xs text-muted-foreground">
                  PIX do vendedor: <span className="font-medium">{course.creator.pix_key}</span>. O acesso é
                  liberado depois que o vendedor aprova o pedido.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-5">
              <h2 className="text-base font-semibold">Sobre o curso</h2>
              <p className="whitespace-pre-line text-sm text-muted-foreground">{course.description ?? '—'}</p>

              {course.creator && (
                <Link
                  to={`/criadores/${course.creator.slug}`}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted"
                >
                  <Avatar>
                    {course.creator.avatar_url && <AvatarImage src={course.creator.avatar_url} alt="" />}
                    <AvatarFallback>{initialsOf(course.creator.display_name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{course.creator.display_name}</p>
                    {course.creator.headline && (
                      <p className="truncate text-xs text-muted-foreground">{course.creator.headline}</p>
                    )}
                  </div>
                </Link>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardContent className="space-y-4 p-4">
              <h3 className="text-sm font-semibold">Conteúdo do curso</h3>

              {course.modules.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum módulo publicado ainda.</p>
              ) : (
                course.modules.map(module => (
                  <div key={module.id} className="space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-medium">{module.title}</p>
                      <span className="text-xs text-muted-foreground">{formatDuration(module.duration_seconds)}</span>
                    </div>

                    <div className="space-y-1">
                      {module.lessons.map(lesson => (
                        <button
                          key={lesson.id}
                          type="button"
                          onClick={() => setSelectedLessonId(lesson.id)}
                          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted ${
                            selectedLessonId === lesson.id ? 'bg-muted font-medium' : ''
                          }`}
                        >
                          {lesson.locked ? (
                            <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          ) : (
                            <PlayCircle className="h-3.5 w-3.5 shrink-0" />
                          )}
                          <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
                          {lesson.is_preview && <Badge variant="outline">Prévia</Badge>}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
};

/** Primeira aula que dá para assistir sem estar inscrito (prévia). */
const firstPlayableLessonId = (course: CourseDetail): string | null =>
  course.modules.flatMap(module => module.lessons).find(lesson => !lesson.locked)?.id ?? null;

const findLesson = (course: CourseDetail, lessonId: string | null) =>
  lessonId ? course.modules.flatMap(module => module.lessons).find(lesson => lesson.id === lessonId) ?? null : null;

export default CourseDetailPage;