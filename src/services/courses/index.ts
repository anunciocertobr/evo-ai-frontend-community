import api from '@/services/core/api';
import type {
  CourseCard,
  CourseDetail,
  CourseLesson,
  CourseModule,
  CourseRows,
  CourseUnlockState,
  CreatorPage,
  CreatorProfile,
  Enrollment,
  EnrollResult,
  LessonPreview,
  ProgressSaved,
  PurchaseRequest,
  PurchaseRequestStatus,
} from './types';

/**
 * O backend responde sempre `{ success, data }` (ApiResponseHelper), e lista
 * paginada traz `meta`/`pagination` ao lado. Desembrulhar em um lugar só
 * evita o mesmo `response.data.data` espalhado por todas as telas.
 */
interface Envelope<T> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
}

const unwrap = <T,>(response: { data: Envelope<T> }): T => response.data.data;

const coursesService = {
  /** Todas as linhas da home em uma request (o backend já filtra por aluno). */
  rows: async (): Promise<CourseRows> => unwrap(await api.get<Envelope<CourseRows>>('/courses/rows')),

  list: async (params: {
    search?: string;
    category?: string;
    free?: boolean;
    paid?: boolean;
    creator?: string;
    page?: number;
    per_page?: number;
  }): Promise<CourseCard[]> => {
    const response = await api.get<Envelope<CourseCard[]>>('/courses', { params });
    return unwrap(response);
  },

  detail: async (slug: string): Promise<CourseDetail> =>
    unwrap(await api.get<Envelope<CourseDetail>>(`/courses/${slug}`)),

  /**
   * Curso gratuito -> 201 com a inscrição; curso pago -> 202 com o pedido na
   * fila do vendedor. O mesmo endpoint, então o status HTTP é o que desambigua.
   */
  enroll: async (
    slug: string,
    payload: { payment_method?: string; note?: string } = {}
  ): Promise<EnrollResult> => {
    const response = await api.post<Envelope<Enrollment | PurchaseRequest>>(`/courses/${slug}/enroll`, payload);

    if (response.status === 202) return { kind: 'pending', request: response.data.data as PurchaseRequest };
    return { kind: 'enrolled', enrollment: response.data.data as Enrollment };
  },

  enrollments: async (): Promise<Enrollment[]> =>
    unwrap(await api.get<Envelope<Enrollment[]>>('/course_enrollments')),

  wishlist: async (slug: string): Promise<{ in_wishlist: boolean }> =>
    unwrap(await api.post<Envelope<{ in_wishlist: boolean }>>(`/courses/${slug}/wishlist`)),

  removeFromWishlist: async (slug: string): Promise<{ in_wishlist: boolean }> =>
    unwrap(await api.delete<Envelope<{ in_wishlist: boolean }>>(`/courses/${slug}/wishlist`)),

  /**
   * Upsert de progresso — o player chama a cada ~15s e no pause. Idempotente
   * por (inscrição, aula) no backend; `position_seconds` é limitado à duração
   * da aula lá, então o cliente pode mandar o que o player-reportar.
   */
  saveProgress: async (
    enrollmentId: string,
    payload: { lesson_id: string; position_seconds: number; completed?: boolean }
  ): Promise<ProgressSaved> =>
    unwrap(
      await api.put<Envelope<ProgressSaved>>(`/course_enrollments/${enrollmentId}/lesson_progresses`, payload)
    ),

  // --- vendedor ---
  creators: async (): Promise<CreatorProfile[]> =>
    unwrap(await api.get<Envelope<CreatorProfile[]>>('/creators')),

  creator: async (slug: string): Promise<CreatorPage> =>
    unwrap(await api.get<Envelope<CreatorPage>>(`/creators/${slug}`)),

  followCreator: async (slug: string): Promise<{ following: boolean }> =>
    unwrap(await api.post<Envelope<{ following: boolean }>>(`/creators/${slug}/follow`)),

  unfollowCreator: async (slug: string): Promise<{ following: boolean }> =>
    unwrap(await api.delete<Envelope<{ following: boolean }>>(`/creators/${slug}/follow`)),

  following: async (): Promise<CreatorProfile[]> =>
    unwrap(await api.get<Envelope<CreatorProfile[]>>('/creator_follows')),

  // --- senha da área do aluno ---
  unlockState: async (token?: string): Promise<CourseUnlockState> =>
    unwrap(await api.get<Envelope<CourseUnlockState>>('/course_unlock', { params: { token } })),

  setPassword: async (password: string): Promise<CourseUnlockState> =>
    unwrap(await api.post<Envelope<CourseUnlockState>>('/course_unlock', { password })),

  verifyPassword: async (password: string): Promise<CourseUnlockState & { token: string }> =>
    unwrap(await api.post<Envelope<CourseUnlockState & { token: string }>>('/course_unlock/verify', { password })),
};

export const creatorAreaService = {
  profile: async (): Promise<CreatorProfile> =>
    unwrap(await api.get<Envelope<CreatorProfile>>('/creator/profile')),

  updateProfile: async (payload: Partial<CreatorProfile>): Promise<CreatorProfile> =>
    unwrap(await api.patch<Envelope<CreatorProfile>>('/creator/profile', { creator_profile: payload })),

  publishProfile: async (): Promise<CreatorProfile> =>
    unwrap(await api.post<Envelope<CreatorProfile>>('/creator/profile/publish')),

  courses: async (): Promise<CourseCard[]> =>
    unwrap(await api.get<Envelope<CourseCard[]>>('/creator/courses')),

  course: async (slug: string): Promise<CourseDetail> =>
    unwrap(await api.get<Envelope<CourseDetail>>(`/creator/courses/${slug}`)),

  createCourse: async (payload: Record<string, unknown>): Promise<CourseCard> =>
    unwrap(await api.post<Envelope<CourseCard>>('/creator/courses', { course: payload })),

  updateCourse: async (slug: string, payload: Record<string, unknown>): Promise<CourseCard> =>
    unwrap(await api.patch<Envelope<CourseCard>>(`/creator/courses/${slug}`, { course: payload })),

  deleteCourse: async (slug: string): Promise<{ id: string }> =>
    unwrap(await api.delete<Envelope<{ id: string }>>(`/creator/courses/${slug}`)),

  publishCourse: async (slug: string): Promise<CourseCard> =>
    unwrap(await api.post<Envelope<CourseCard>>(`/creator/courses/${slug}/publish`)),

  unpublishCourse: async (slug: string): Promise<CourseCard> =>
    unwrap(await api.post<Envelope<CourseCard>>(`/creator/courses/${slug}/unpublish`)),

  createModule: async (courseSlug: string, payload: { title: string; position?: number }): Promise<CourseModule> =>
    unwrap(await api.post<Envelope<CourseModule>>(`/creator/courses/${courseSlug}/modules`, { course_module: payload })),

  updateModule: async (
    courseSlug: string,
    moduleId: string,
    payload: { title: string; position?: number }
  ): Promise<CourseModule> =>
    unwrap(
      await api.patch<Envelope<CourseModule>>(`/creator/courses/${courseSlug}/modules/${moduleId}`, {
        course_module: payload,
      })
    ),

  deleteModule: async (courseSlug: string, moduleId: string): Promise<{ id: string }> =>
    unwrap(await api.delete<Envelope<{ id: string }>>(`/creator/courses/${courseSlug}/modules/${moduleId}`)),

  createLesson: async (
    courseSlug: string,
    payload: {
      course_module_id: string;
      title: string;
      video_url: string;
      description?: string;
      position?: number;
      is_preview?: boolean;
    }
  ): Promise<CourseLesson> =>
    unwrap(
      await api.post<Envelope<CourseLesson>>(`/creator/courses/${courseSlug}/lessons`, { course_lesson: payload })
    ),

  updateLesson: async (
    courseSlug: string,
    lessonId: string,
    payload: { title?: string; video_url?: string; description?: string; position?: number; is_preview?: boolean }
  ): Promise<CourseLesson> =>
    unwrap(
      await api.patch<Envelope<CourseLesson>>(`/creator/courses/${courseSlug}/lessons/${lessonId}`, {
        course_lesson: payload,
      })
    ),

  deleteLesson: async (courseSlug: string, lessonId: string): Promise<{ id: string }> =>
    unwrap(await api.delete<Envelope<{ id: string }>>(`/creator/courses/${courseSlug}/lessons/${lessonId}`)),

  /** Resolve a URL colada pelo criador e mostra a thumb antes de salvar. */
  previewLesson: async (courseSlug: string, videoUrl: string): Promise<LessonPreview> =>
    unwrap(
      await api.post<Envelope<LessonPreview>>(`/creator/courses/${courseSlug}/lessons/preview`, {
        video_url: videoUrl,
      })
    ),

  purchaseRequests: async (status?: PurchaseRequestStatus): Promise<PurchaseRequest[]> =>
    unwrap(await api.get<Envelope<PurchaseRequest[]>>('/creator/purchase_requests', { params: { status } })),

  approvePurchase: async (id: string, note?: string): Promise<PurchaseRequest> =>
    unwrap(await api.post<Envelope<PurchaseRequest>>(`/creator/purchase_requests/${id}/approve`, { note })),

  rejectPurchase: async (id: string, note?: string): Promise<PurchaseRequest> =>
    unwrap(await api.post<Envelope<PurchaseRequest>>(`/creator/purchase_requests/${id}/reject`, { note })),
};

export default coursesService;