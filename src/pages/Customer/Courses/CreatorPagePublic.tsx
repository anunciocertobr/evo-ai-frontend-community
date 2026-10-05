import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage, Button, Card, CardContent } from '@evoapi/design-system';
import coursesService from '@/services/courses';
import type { CreatorPage } from '@/services/courses/types';
import CourseCard from '@/components/courses/CourseCard';
import { formatStudents, initialsOf } from '@/components/courses/courseFormatters';

export const CreatorPagePublic = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [page, setPage] = useState<CreatorPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);

  const load = useCallback(async () => {
    if (!slug) return;

    setLoading(true);
    try {
      const data = await coursesService.creator(slug);
      setPage(data);
      setFollowing(data.creator.followed_by_me);
    } catch {
      toast.error('Criador não encontrado.');
      navigate('/cursos');
    } finally {
      setLoading(false);
    }
  }, [slug, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleFollow = async () => {
    if (!page) return;

    try {
      if (following) {
        await coursesService.unfollowCreator(page.creator.slug);
        toast.success('Você deixou de seguir este criador.');
        setFollowing(false);
      } else {
        await coursesService.followCreator(page.creator.slug);
        toast.success('Agora você segue este criador.');
        setFollowing(true);
      }
      await load();
    } catch {
      toast.error('Não foi possível atualizar o seu seguimento.');
    }
  };

  if (loading || !page) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { creator, courses } = page;

  return (
    <div className="flex min-h-full flex-col gap-6 bg-background p-6">
      <Button variant="ghost" className="w-fit" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
      </Button>

      <Card className="overflow-hidden">
        <div className="aspect-[21/9] w-full bg-muted">
          {creator.banner_url ? (
            <img src={creator.banner_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-primary/15 via-muted to-muted" />
          )}
        </div>

        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start">
          <Avatar className="h-20 w-20 -mt-12 border-4 border-background">
            {creator.avatar_url && <AvatarImage src={creator.avatar_url} alt="" />}
            <AvatarFallback>{initialsOf(creator.display_name)}</AvatarFallback>
          </Avatar>

          <div className="flex flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold">{creator.display_name}</h1>
                {creator.headline && <p className="text-sm text-muted-foreground">{creator.headline}</p>}
              </div>
              <Button variant={following ? 'secondary' : 'default'} onClick={toggleFollow}>
                {following ? 'Seguindo' : 'Seguir'}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4" /> {formatStudents(creator.students_count)}
              </span>
              <span>{creator.courses_count} {creator.courses_count === 1 ? 'curso' : 'cursos'}</span>
              <span>{creator.followers_count} {creator.followers_count === 1 ? 'seguidor' : 'seguidores'}</span>
            </div>

            {creator.bio && <p className="whitespace-pre-line text-sm text-muted-foreground">{creator.bio}</p>}
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Cursos publicados</h2>
        {courses.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Este criador ainda não publicou nenhum curso.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {courses.map(course => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default CreatorPagePublic;