import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MuteConversationPanel } from './MuteConversationPanel';
import { MuteConversationNodeData } from './MuteConversationNode';
import '@/i18n/config';

vi.mock('@/services/automation/automationService', () => ({
  automationService: { getFormData: vi.fn() },
}));

import { automationService } from '@/services/automation/automationService';

const mockGetFormData = automationService.getFormData as unknown as ReturnType<typeof vi.fn>;

function makeData(overrides: Partial<MuteConversationNodeData> = {}): MuteConversationNodeData {
  return { label: 'Mute Conversation', ...overrides };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('MuteConversationPanel — no auto-persist on load', () => {
  it('does not call onUpdate merely from loading form data', async () => {
    mockGetFormData.mockResolvedValueOnce({ agents: [{ id: 1 }], teams: [{ id: 2 }] });
    const onUpdate = vi.fn();

    render(
      <MuteConversationPanel nodeId="n1" data={makeData()} onUpdate={onUpdate} onClose={vi.fn()} />,
    );

    await waitFor(() => expect(mockGetFormData).toHaveBeenCalled());
    expect(onUpdate).not.toHaveBeenCalled();
  });
});

// CRM-139: o painel não tem campo editável, então nada pode ficar sujo — o
// dirty={!loading} anterior habilitava Salvar sozinho ao fim do carregamento.
describe('MuteConversationPanel — Save gated by real edits', () => {
  it('keeps Save disabled after the form data finishes loading', async () => {
    mockGetFormData.mockResolvedValueOnce({ agents: [], teams: [] });

    render(
      <MuteConversationPanel nodeId="n1" data={makeData()} onUpdate={vi.fn()} onClose={vi.fn()} />,
    );

    // Cancelar reabilita só depois que o loading termina — é o sinal de que o
    // painel já está no estado final, e não que Salvar está travado pelo spinner.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /cancel|cancelar/i })).not.toBeDisabled(),
    );
    expect(screen.getByRole('button', { name: /save|salvar/i })).toBeDisabled();
  });
});
