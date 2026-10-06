import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, Trash2, BookOpen, FileVideo2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  Badge,
} from '@evoapi/design-system';
import { BaseHeader } from '@/components/base';
import { creatorAreaService } from '@/services/courses';
import type { CourseCard, CourseLevel } from '@/services/courses/types';
import { LEVEL_VALUES } from '@/components/courses/courseFormatters';

const EMPTY_FORM = {
  title: '',
  subtitle: '',
  description: '',
  category: '',
  level: 'beginner' as CourseLevel,
  price_cents: 0,
  thumbnail_url: '',
  trailer_url: '',
};

export const CreatorCoursesPage = () => {
  const navigate = useNavigate();

  const [courses, setCourses] = useState<CourseCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCourses(await creatorAreaService.courses());
    } catch {
      toast.error('Não foi possível carregar seus cursos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.title.trim()) {
      toast.error('Dê um título para o curso.');
      return;
    }

    setCreating(true);
    try {
      const course = await creatorAreaService.createCourse({
        ...form,
        price_cents: Number(form.price_cents) || 0,
      });
      toast.success('Curso criado. Agora adicione módulos e aulas.');
      setOpen(false);
      setForm(EMPTY_FORM);
      await load();
      navigate(`/criador/cursos/${course.slug}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível criar o curso.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (slug: string) => {
    if (!confirm('Excluir este curso? Esta ação não pode ser desfeita.')) return;

    setDeletingSlug(slug);
    try {
      await creatorAreaService.deleteCourse(slug);
      toast.success('Curso excluído.');
      await load();
    } catch {
      toast.error('Não foi possível excluir o curso.');
    } finally {
      setDeletingSlug(null);
    }
  };

  const publishedCount = useMemo(() => courses.filter(c => c.status === 'published').length, [courses]);

  return (
    <div className="flex min-h-full flex-col gap-6 bg-background p-6">
      <BaseHeader
        title="Meus cursos"
        subtitle="Crie, organize e publique seus cursos."
        primaryAction={{
          label: 'Novo curso',
          icon: <Plus className="h-4 w-4" />,
          onClick: () => setOpen(true),
          variant: 'default',
        }}
      />

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : courses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Você ainda não tem cursos</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Crie seu primeiro curso para começar a vender ou distribuir gratuitamente.
            </p>
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Criar primeiro curso
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{courses.length} cursos</Badge>
            <Badge variant="outline">{publishedCount} publicados</Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {courses.map(course => (
              <Card key={course.id} className="overflow-hidden">
                <div className="relative aspect-video w-full bg-muted">
                  {course.thumbnail_url ? (
                    <img src={course.thumbnail_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-muted">
                      <FileVideo2 className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute left-2 top-2">
                    <Badge variant={course.status === 'published' ? 'default' : 'secondary'}>
                      {course.status === 'published' ? 'Publicado' : 'Rascunho'}
                    </Badge>
                  </div>
                </div>

                <CardContent className="space-y-3 p-4">
                  <div>
                    <h3 className="line-clamp-2 text-sm font-semibold">{course.title}</h3>
                    {course.subtitle && <p className="line-clamp-1 text-xs text-muted-foreground">{course.subtitle}</p>}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      <span>{course.lessons_count} aulas</span>
                      <span>{course.price_formatted}</span>
                      <span>{course.students_count} alunos</span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/criador/cursos/${course.slug}`)}>
                        Editar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/cursos/${course.slug}`)}>
                        Ver na vitrine
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => void handleDelete(course.slug)}
                        disabled={deletingSlug === course.slug}
                      >
                        {deletingSlug === course.slug ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={handleCreate} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Novo curso</DialogTitle>
            </DialogHeader>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="course-title">Título *</Label>
                <Input
                  id="course-title"
                  value={form.title}
                  onChange={event => setForm(previous => ({ ...previous, title: event.target.value }))}
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="course-subtitle">Subtítulo</Label>
                <Input
                  id="course-subtitle"
                  value={form.subtitle}
                  onChange={event => setForm(previous => ({ ...previous, subtitle: event.target.value }))}
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="course-description">Descrição</Label>
                <Textarea
                  id="course-description"
                  rows={4}
                  value={form.description}
                  onChange={event => setForm(previous => ({ ...previous, description: event.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <Label>Categoria</Label>
                <Input
                  value={form.category}
                  onChange={event => setForm(previous => ({ ...previous, category: event.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <Label>Nível</Label>
                <Select
                  value={form.level}
                  onValueChange={(value: CourseLevel) => setForm(previous => ({ ...previous, level: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVEL_VALUES.map(item => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Preço (centavos)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.price_cents}
                  onChange={event =>
                    setForm(previous => ({ ...previous, price_cents: Number(event.target.value) || 0 }))
                  }
                />
                <p className="text-xs text-muted-foreground">0 = curso gratuito</p>
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label>URL da thumbnail</Label>
                <Input
                  value={form.thumbnail_url}
                  onChange={event => setForm(previous => ({ ...previous, thumbnail_url: event.target.value }))}
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label>URL do trailer (YouTube/Vimeo)</Label>
                <Input
                  value={form.trailer_url}
                  onChange={event => setForm(previous => ({ ...previous, trailer_url: event.target.value }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={creating}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar curso
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreatorCoursesPage;