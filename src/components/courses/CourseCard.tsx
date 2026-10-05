import { Link } from 'react-router-dom';
import { PlayCircle, Clock, Users, Star, Heart, CheckCircle2 } from 'lucide-react';
import { Badge, Card, CardContent, Progress } from '@evoapi/design-system';
import { cn } from '@/utils/cn';
import type { CourseCard as CourseCardType } from '@/services/courses/types';
import { formatDuration, initialsOf, LEVEL_LABELS } from './courseFormatters';

interface CourseCardProps {
  course: CourseCardType;
  /** Largura fixa da fileira horizontal do "Netflix". */
  className?: string;
  onToggleWishlist?: (course: CourseCardType) => void;
}

/**
 * Card da vitrine.
 *
 * O estado do aluno vem inteiro em `course.viewer` (wishlisted, purchase_pending,
 * enrolled, progress_percent) — a tela não guarda cópia local disso, senão o
 * coração e o badge de "pedido enviado" desandam do que o servidor respondeu.
 */
export const CourseCard = ({ course, className, onToggleWishlist }: CourseCardProps) => {
  const { viewer } = course;

  return (
    <Card className={cn('group relative overflow-hidden', className)}>
      <Link
        to={`/cursos/${course.slug}`}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div className="relative aspect-video w-full overflow-hidden bg-muted">
          {course.thumbnail_url ? (
            <img
              src={course.thumbnail_url}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 via-muted to-muted">
              <span className="text-2xl font-semibold text-muted-foreground">
                {initialsOf(course.title)}
              </span>
            </div>
          )}

          <div className="absolute left-2 top-2 flex flex-wrap gap-1">
            {course.free ? <Badge variant="secondary">Gratuito</Badge> : <Badge>{course.price_formatted}</Badge>}
            {viewer.purchase_pending && <Badge variant="outline">Pedido enviado</Badge>}
            {viewer.enrolled && course.viewer.progress_percent >= 100 && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> Concluído
              </Badge>
            )}
          </div>

          {onToggleWishlist && (
            <button
              type="button"
              aria-label={viewer.wishlisted ? 'Remover da lista de desejos' : 'Adicionar à lista de desejos'}
              aria-pressed={viewer.wishlisted}
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                onToggleWishlist(course);
              }}
              className="absolute right-2 top-2 rounded-full bg-background/80 p-1.5 text-foreground opacity-0 transition-opacity hover:bg-background focus-visible:opacity-100 group-hover:opacity-100"
            >
              <Heart className={cn('h-4 w-4', viewer.wishlisted && 'fill-red-500 text-red-500')} />
            </button>
          )}
        </div>

        <CardContent className="space-y-2 p-3">
          <h3 className="line-clamp-2 text-sm font-semibold leading-tight">{course.title}</h3>

          {course.subtitle && <p className="line-clamp-1 text-xs text-muted-foreground">{course.subtitle}</p>}

          {viewer.enrolled && viewer.progress_percent > 0 && (
            <div className="space-y-1">
              <Progress value={viewer.progress_percent} className="h-1.5" />
              <p className="text-[11px] text-muted-foreground">{Math.round(viewer.progress_percent)}% assistido</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <PlayCircle className="h-3 w-3" /> {course.lessons_count} aulas
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> {formatDuration(course.duration_seconds)}
            </span>
            {course.students_count > 0 && (
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" /> {course.students_count}
              </span>
            )}
            {course.rating_count > 0 && (
              <span className="inline-flex items-center gap-1">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {course.rating_average.toFixed(1)}
              </span>
            )}
          </div>

          {course.creator && (
            <p className="truncate text-[11px] text-muted-foreground">
              por {course.creator.display_name} · {LEVEL_LABELS[course.level]}
            </p>
          )}
        </CardContent>
      </Link>
    </Card>
  );
};

export default CourseCard;