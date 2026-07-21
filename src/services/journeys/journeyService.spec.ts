import { beforeEach, describe, expect, it, vi } from 'vitest';
import { journeyService } from './journeyService';
import api from '@/services/core/api';

// EVO-2191: journeys now go through the CRM proxy (`api`), like segments — not the
// evo-flow-direct `apiEvoFlow`. Mock `api` accordingly.
vi.mock('@/services/core/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('journeyService session methods — envelope unwrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getJourneySessionStats unwraps the { success, data } envelope', async () => {
    const innerPayload = {
      total: 3,
      byStatus: { active: 1, waiting: 0, paused: 0, completed: 2, failed: 0, cancelled: 0 },
    };
    vi.mocked(api.get).mockResolvedValue({
      data: { success: true, data: innerPayload },
    } as never);

    const result = await journeyService.getJourneySessionStats('journey-1');

    expect(api.get).toHaveBeenCalledWith('/journeys/journey-1/sessions/stats');
    expect(result.data).toEqual(innerPayload);
    expect(result.data.byStatus.active).toBe(1);
  });

  it('getJourneySessionStats falls back to raw response when envelope is absent', async () => {
    const rawPayload = {
      total: 0,
      byStatus: { active: 0, waiting: 0, paused: 0, completed: 0, failed: 0, cancelled: 0 },
    };
    vi.mocked(api.get).mockResolvedValue({ data: rawPayload } as never);

    const result = await journeyService.getJourneySessionStats('journey-1');

    expect(result.data).toEqual(rawPayload);
  });

  it('getJourneySessions unwraps the envelope and surfaces the sessions array', async () => {
    const inner = { sessions: [{ id: 's-1', status: 'active' }], total: 1, page: 1, pageSize: 20 };
    vi.mocked(api.get).mockResolvedValue({
      data: { success: true, data: inner },
    } as never);

    const result = await journeyService.getJourneySessions('journey-1', { page: 1, pageSize: 20 });

    expect(api.get).toHaveBeenCalledWith('/journeys/journey-1/sessions', {
      params: { page: 1, pageSize: 20 },
    });
    expect(result.data.sessions).toHaveLength(1);
    expect(result.data.total).toBe(1);
  });

  it('getJourneySession unwraps the envelope for a single session lookup', async () => {
    const inner = { id: 's-1', status: 'active', journeyId: 'journey-1' };
    vi.mocked(api.get).mockResolvedValue({
      data: { success: true, data: inner },
    } as never);

    const result = await journeyService.getJourneySession('journey-1', 's-1');

    expect(result.data).toEqual(inner);
  });

  it('cancelJourneySession unwraps the envelope on the post response', async () => {
    const inner = { id: 's-1', status: 'cancelled' };
    vi.mocked(api.post).mockResolvedValue({
      data: { success: true, data: inner },
    } as never);

    const result = await journeyService.cancelJourneySession('journey-1', 's-1');

    expect(api.post).toHaveBeenCalledWith(
      '/journeys/journey-1/sessions/s-1/cancel',
      {},
    );
    expect(result.data).toEqual(inner);
  });

  it('bulkDeleteJourneySessions unwraps the envelope on the bulk delete response', async () => {
    vi.mocked(api.delete).mockResolvedValue({
      data: { success: true, data: { deleted: 5 } },
    } as never);

    const result = await journeyService.bulkDeleteJourneySessions('journey-1', 'completed');

    expect(result.data.deleted).toBe(5);
  });
});

describe('journeyService variable methods — envelope unwrap (EVO-1836)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getJourneyVariables unwraps the { success, data } envelope into the variables array', async () => {
    const vars = [{ id: 'var_1', name: 'lead_score', type: 'number', defaultValue: '0' }];
    vi.mocked(api.get).mockResolvedValue({
      data: { success: true, data: vars },
    } as never);

    const result = await journeyService.getJourneyVariables('journey-1');

    expect(api.get).toHaveBeenCalledWith('/journeys/journey-1/variables');
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data).toEqual(vars);
  });

  it('getJourneyVariables returns [] when the unwrapped payload is not an array', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { success: true, data: null },
    } as never);

    const result = await journeyService.getJourneyVariables('journey-1');

    expect(result.data).toEqual([]);
  });

  it('updateJourneyVariables returns the variables array, not the envelope object (the crash regression)', async () => {
    const vars = [{ id: 'var_1', name: 'lead_score', type: 'number', defaultValue: '0' }];
    vi.mocked(api.post).mockResolvedValue({
      data: { success: true, data: vars, meta: { timestamp: 'x' } },
    } as never);

    const result = await journeyService.updateJourneyVariables('journey-1', vars);

    expect(api.post).toHaveBeenCalledWith('/journeys/journey-1/variables', vars);
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data).toEqual(vars);
  });
});

// EVO-2191/EVO-2188: the CRM proxy gates each operation by permission derived from
// the HTTP method + subpath (Guilherme's review). These lock the exact URLs so a
// future rename (e.g. /toggle-active -> /toggle, or breaking a /sessions path) can't
// silently drift the operation onto the wrong journeys.* permission and 403.
describe('CRM proxy path contract (permission mapping)', () => {
  beforeEach(() => vi.clearAllMocks());

  const ok = { data: { id: 'j1' } } as never;

  it('createJourney POSTs /journeys (maps to journeys.create)', async () => {
    vi.mocked(api.post).mockResolvedValue(ok);
    await journeyService.createJourney({ name: 'x', flowData: {} as never, flowTriggers: [] as never });
    expect(api.post).toHaveBeenCalledWith('/journeys', expect.objectContaining({ name: 'x' }));
  });

  it('updateJourney PATCHes /journeys/:id (maps to journeys.update)', async () => {
    vi.mocked(api.patch).mockResolvedValue(ok);
    await journeyService.updateJourney('j1', { name: 'y' } as never);
    expect(api.patch).toHaveBeenCalledWith('/journeys/j1', expect.objectContaining({ name: 'y' }));
  });

  it('deleteJourney DELETEs /journeys/:id (maps to journeys.delete)', async () => {
    vi.mocked(api.delete).mockResolvedValue(ok);
    await journeyService.deleteJourney('j1');
    expect(api.delete).toHaveBeenCalledWith('/journeys/j1');
  });

  it('toggleJourney POSTs /journeys/:id/toggle-active (maps to journeys.toggle_active)', async () => {
    vi.mocked(api.post).mockResolvedValue(ok);
    await journeyService.toggleJourney('j1');
    expect(api.post).toHaveBeenCalledWith('/journeys/j1/toggle-active', {});
  });

  it('duplicateJourney POSTs /journeys/:id/duplicate (maps to journeys.duplicate)', async () => {
    vi.mocked(api.post).mockResolvedValue(ok);
    await journeyService.duplicateJourney('j1');
    expect(api.post).toHaveBeenCalledWith('/journeys/j1/duplicate', {});
  });

  it('deleteJourneySession DELETEs a /sessions/ path (maps to journeys.manage_sessions, not journeys.delete)', async () => {
    vi.mocked(api.delete).mockResolvedValue(ok);
    await journeyService.deleteJourneySession('j1', 's1');
    expect(api.delete).toHaveBeenCalledWith('/journeys/j1/sessions/s1');
  });
});
