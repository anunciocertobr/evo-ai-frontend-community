import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeferConversationPanel } from './DeferConversationPanel';
import { DeferConversationNodeData } from './DeferConversationNode';
import '@/i18n/config';

vi.mock('@/services/automation/automationService', () => ({
  automationService: { getFormData: vi.fn() },
}));

import { automationService } from '@/services/automation/automationService';

const mockGetFormData = automationService.getFormData as unknown as ReturnType<typeof vi.fn>;

function makeData(overrides: Partial<DeferConversationNodeData> = {}): DeferConversationNodeData {
  return { label: 'Defer Conversation', ...overrides };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('DeferConversationPanel — no auto-persist on load', () => {
  it('does not call onUpdate merely from loading form data', async () => {
    mockGetFormData.mockResolvedValueOnce({ agents: [{ id: 1 }], teams: [{ id: 2 }] });
    const onUpdate = vi.fn();

    render(
      <DeferConversationPanel
        nodeId="n1"
        data={makeData()}
        onUpdate={onUpdate}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => expect(mockGetFormData).toHaveBeenCalled());
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
