import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SendEmailTeamPanel } from './SendEmailTeamPanel';
import { SendEmailTeamNodeData } from './SendEmailTeamNode';
import '@/i18n/config';

vi.mock('@/services/automation/automationService', () => ({
  automationService: { getFormData: vi.fn() },
}));

import { automationService } from '@/services/automation/automationService';

const mockGetFormData = automationService.getFormData as unknown as ReturnType<typeof vi.fn>;

function makeData(overrides: Partial<SendEmailTeamNodeData> = {}): SendEmailTeamNodeData {
  return { label: 'Send Email to Team', ...overrides };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('SendEmailTeamPanel — no auto-persist on load', () => {
  it('does not call onUpdate merely from loading form data', async () => {
    mockGetFormData.mockResolvedValueOnce({ teams: [{ id: 1, name: 'T' }] });
    const onUpdate = vi.fn();

    render(
      <SendEmailTeamPanel nodeId="n1" data={makeData()} onUpdate={onUpdate} onClose={vi.fn()} />,
    );

    await waitFor(() => expect(mockGetFormData).toHaveBeenCalled());
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
