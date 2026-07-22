import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Pipelines from './Pipelines';
import { Pipeline } from '@/types/analytics';

// EVO-2122: deactivating a pipeline used to be a silent no-op. Now that it persists,
// the management screen is the only place a deactivated pipeline stays reachable —
// it must opt into include_inactive, and the toast must report what the API saved.
const inactivePipeline: Pipeline = {
  id: 'p-inactive',
  name: 'Retired funnel',
  description: null,
  pipeline_type: 'sales',
  visibility: 'public',
  is_active: false,
  is_default: false,
  custom_fields: { attributes: [] },
  item_count: 0,
  conversations_count: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  stages: [],
} as unknown as Pipeline;

const getPipelines = vi.fn();
const togglePipelineStatus = vi.fn();
const success = vi.fn();
const error = vi.fn();

vi.mock('@/services/pipelines', () => ({
  pipelinesService: {
    getPipelines: (...args: unknown[]) => getPipelines(...args),
    togglePipelineStatus: (...args: unknown[]) => togglePipelineStatus(...args),
    updatePipeline: vi.fn(),
    deletePipeline: vi.fn(),
    duplicatePipeline: vi.fn(),
    setAsDefault: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => success(...args),
    error: (...args: unknown[]) => error(...args),
  },
}));

vi.mock('@/contexts/PermissionsContext', () => ({
  usePermissions: () => ({ can: () => true, isReady: true, loading: false }),
}));

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (key: string) => key, currentLanguage: 'en' }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/tours', () => ({
  PipelinesTour: () => null,
}));

// The row action menu is an unlabelled icon button; anchor on the ARIA contract
// (aria-haspopup="menu") instead of the design-system's internal markup.
async function clickActivate() {
  await screen.findByText('Retired funnel');

  const [trigger] = screen
    .getAllByRole('button')
    .filter(button => button.getAttribute('aria-haspopup') === 'menu');

  await userEvent.click(trigger);
  await userEvent.click(await screen.findByText('pipelinesTable.actions.activate'));
}

describe('Pipelines management screen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPipelines.mockResolvedValue({ data: [inactivePipeline], meta: {} });
    togglePipelineStatus.mockResolvedValue({ ...inactivePipeline, is_active: true });
  });

  it('asks the API for inactive pipelines too (AC2, AC3)', async () => {
    render(<Pipelines />);

    await waitFor(() => expect(getPipelines).toHaveBeenCalled());
    expect(getPipelines).toHaveBeenCalledWith(
      expect.objectContaining({ include_inactive: true }),
    );
  });

  it('lists a deactivated pipeline with the inactive badge (AC2)', async () => {
    render(<Pipelines />);

    expect(await screen.findByText('Retired funnel')).toBeInTheDocument();
    expect(screen.getByText('pipelinesTable.status.inactive')).toBeInTheDocument();
  });

  it('reports no success when the API did not persist the requested state (AC4)', async () => {
    // The API answers with is_active still false: the "Activate" click did not take effect.
    togglePipelineStatus.mockResolvedValue({ ...inactivePipeline, is_active: false });
    render(<Pipelines />);

    await clickActivate();

    await waitFor(() => expect(error).toHaveBeenCalledWith('messages.toggleError'));
    expect(success).not.toHaveBeenCalled();
  });

  it('reports success when the API persisted the requested state (AC3)', async () => {
    togglePipelineStatus.mockResolvedValue({ ...inactivePipeline, is_active: true });
    render(<Pipelines />);

    await clickActivate();

    await waitFor(() => expect(success).toHaveBeenCalledWith('messages.activateSuccess'));
    expect(error).not.toHaveBeenCalled();
  });
});
