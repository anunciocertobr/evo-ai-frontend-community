import { CourseCard as CourseCardItem } from './CourseCard';
import type { CourseCard } from '@/services/courses/types';

interface CourseRowProps {
  title: string;
  courses: CourseCard[];
  onToggleWishlist?: (course: CourseCard) => void;
}

/**
 * Fileira horizontal da home do aluno.
 *
 * Linha vazia não renderiza nada (e não ocupa altura com "nada por aqui"): na
 * primeira carga é normal o aluno não ter curso nenhum ainda, e a tela ficaria
 * com um monte de título sem conteúdo.
 */
export const CourseRow = ({ title, courses, onToggleWishlist }: CourseRowProps) => {
  if (courses.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{title}</h2>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {courses.map(course => (
          <CourseCardItem
            key={course.id}
            course={course}
            onToggleWishlist={onToggleWishlist}
            className="w-64 shrink-0 sm:w-72"
          />
        ))}
      </div>
    </section>
  );
};

export default CourseRow;