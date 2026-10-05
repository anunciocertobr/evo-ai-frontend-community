/**
 * Tipos espelham EXATAMENTE o que os serializers do backend devolvem
 * (CourseSerializer / CourseDetailSerializer / CreatorProfileSerializer /
 * CoursePurchaseRequestSerializer). Divergir daqui quebra a tela em silêncio:
 * `undefined` não é erro de TypeScript quando o dado chega do axios.
 *
 * Consequências desse contrato que valem lembrar ao usar estes tipos:
 * - o card do curso NÃO traz `modules_count` (só `lessons_count`);
 * - o criador dentro do card é um resumo de 4 campos; o perfil completo só vem
 *   em `CourseDetail.creator` e em `CreatorPage.creator`;
 * - o estado do aluno vem em `viewer` (wishlisted/purchase_pending), não em
 *   flags soltas no card;
 * - o embed da aula chega em `embed_url` e só vem preenchido quando a aula está
 *   liberada (`locked === false`) — o servidor decide, o cliente não deduz.
 */

export type CourseStatus = 'draft' | 'published' | 'archived';
export type CourseLevel = 'beginner' | 'intermediate' | 'advanced' | 'all';
export type VideoProvider = 'youtube' | 'vimeo';
export type EnrollmentSource = 'free' | 'purchase';
export type PurchaseRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface CreatorSummary {
  id: string;
  slug: string;
  display_name: string;
  avatar_url: string | null;
}

export interface CreatorProfile {
  id: string;
  slug: string;
  display_name: string;
  headline: string | null;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  whatsapp: string | null;
  pix_key: string | null;
  published: boolean;
  published_at: string | null;
  courses_count: number;
  followers_count: number;
  students_count: number;
  followed_by_me: boolean;
  created_at: string | null;
  updated_at: string | null;
}

/** O que o card precisa saber sobre AQUele aluno (vem do servidor). */
export interface ViewerState {
  enrolled: boolean;
  progress_percent: number;
  wishlisted: boolean;
  purchase_pending: boolean;
}

export interface CourseCard {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  category: string | null;
  level: CourseLevel;
  status: CourseStatus;
  created_at: string | null;
  updated_at: string | null;
  thumbnail_url: string | null;
  trailer_provider: VideoProvider | null;
  trailer_video_id: string | null;
  trailer_embed_url: string | null;
  price_cents: number;
  price_formatted: string;
  currency: string;
  free: boolean;
  paid: boolean;
  lessons_count: number;
  duration_seconds: number;
  students_count: number;
  rating_average: number;
  rating_count: number;
  creator: CreatorSummary | null;
  viewer: ViewerState;
}

export interface CourseLesson {
  id: string;
  title: string;
  description: string | null;
  position: number;
  duration_seconds: number;
  video_provider: VideoProvider | null;
  is_preview: boolean;
  /** `true` = o servidor não mandou embed_url (aula de curso pago). */
  locked: boolean;
  embed_url: string | null;
}

export interface CourseModule {
  id: string;
  title: string;
  position: number;
  duration_seconds: number;
  lessons: CourseLesson[];
}

export interface CourseEnrollmentSummary {
  id: string;
  status: string;
  source: EnrollmentSource;
  progress_percent: number;
  last_lesson_id: string | null;
  started_at: string | null;
  last_watched_at: string | null;
  completed_at: string | null;
}

export interface EnrollmentLesson {
  id: string;
  title: string;
  position: number;
  duration_seconds: number;
  is_preview: boolean;
  completed: boolean;
  position_seconds: number;
}

export interface Enrollment extends CourseEnrollmentSummary {
  course: CourseCard;
  /** Só no `GET /course_enrollments/:id`. */
  lessons?: EnrollmentLesson[];
}

export interface CourseDetail extends CourseCard {
  creator: (CreatorProfile & { published_at: string | null }) | null;
  modules: CourseModule[];
  enrollment: CourseEnrollmentSummary | null;
  enrolled: boolean;
}

export interface PurchaseRequest {
  id: string;
  status: PurchaseRequestStatus;
  status_label: string;
  payment_method: string;
  price_cents: number;
  price_formatted: string;
  currency: string;
  note: string | null;
  course: { id: string; title: string } | null;
  student: { name: string | null; email: string | null } | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface ProgressSaved {
  lesson_id: string;
  position_seconds: number;
  completed: boolean;
  course_progress_percent: number;
  enrollment_status: string;
}

/**
 * Resposta de POST /courses/:slug/enroll.
 *
 * O status HTTP é o que diferencia, e é proposital (o comentário do controller
 * explica): 201 = matriculado agora (curso gratuito), 202 = pedido na fila do
 * vendedor (curso pago). Por isso o união — não há um "tipo do retorno".
 */
export type EnrollResult = { kind: 'enrolled'; enrollment: Enrollment } | { kind: 'pending'; request: PurchaseRequest };

export interface CourseRows {
  continue_watching: CourseCard[];
  enrolled: CourseCard[];
  completed: CourseCard[];
  wishlist: CourseCard[];
  following: CourseCard[];
  trending: CourseCard[];
  free: CourseCard[];
  new: CourseCard[];
}

export interface CreatorPage {
  creator: CreatorProfile;
  courses: CourseCard[];
}

export interface CourseUnlockState {
  configured: boolean;
  unlocked: boolean;
  failed_attempts: number;
  locked: boolean;
}

export interface LessonPreview {
  provider: VideoProvider | null;
  video_id: string | null;
  embed_url: string | null;
  title: string | null;
}

/** A home abre igual com o backend sem nenhum curso: linhas vazias, não undefined. */
export const EMPTY_COURSE_ROWS: CourseRows = {
  continue_watching: [],
  enrolled: [],
  completed: [],
  wishlist: [],
  following: [],
  trending: [],
  free: [],
  new: [],
};