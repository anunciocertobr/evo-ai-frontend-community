import type { CourseLevel } from '@/services/courses/types';

/** Rótulos em pt-BR. A API devolve os enums em inglês de propósito (banco/servidor). */
export const LEVEL_LABELS: Record<CourseLevel, string> = {
  beginner: 'Iniciante',
  intermediate: 'Intermediário',
  advanced: 'Avançado',
  all: 'Todos os níveis',
};

export const LEVEL_VALUES: Array<{ value: CourseLevel; label: string }> = (
  Object.keys(LEVEL_LABELS) as CourseLevel[]
).map(value => ({ value, label: LEVEL_LABELS[value] }));

/**
 * Duração em texto legível. `duration_seconds` vem do banco já somado
 * (Course#duration_seconds), então aqui é só formatação — nunca calcular
 * progresso com isso.
 */
export const formatDuration = (seconds: number | null | undefined): string => {
  const total = Math.max(0, Math.round(seconds ?? 0));
  if (total === 0) return '—';

  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}min`;
};

export const formatStudents = (count: number | null | undefined): string => {
  const total = Math.max(0, count ?? 0);
  if (total === 0) return 'Nenhum aluno ainda';
  if (total === 1) return '1 aluno';
  return `${total.toLocaleString('pt-BR')} alunos`;
};

/** Iniciais para o fallback do avatar quando o criador não subiu foto. */
export const initialsOf = (name: string | null | undefined): string => {
  const clean = (name ?? '').trim();
  if (!clean) return '?';

  return clean
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');
};
