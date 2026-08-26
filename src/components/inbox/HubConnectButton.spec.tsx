import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HubConnectButton from './HubConnectButton';
import { api } from '@/services/core';

vi.mock('@/services/core', () => ({
  api: { post: vi.fn(), get: vi.fn() },
}));

vi.mock('@/contexts/GlobalConfigContext', () => ({
  useGlobalConfig: () => ({ config: { hubAllowExistingChannels: false } }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) } }));

const INBOX_ID = 'inbox-42';

async function criarInbox() {
  vi.mocked(api.post).mockResolvedValue({
    data: { data: { id: INBOX_ID, evolution_hub: { public_link: 'http://localhost:8050/connect/tok' } } },
  } as never);

  render(<HubConnectButton channelType="whatsapp_cloud" name="Canal Teste" />);
  await userEvent.click(screen.getByRole('button', { name: /conectar|criar/i }));
  await screen.findByTestId('hub-waiting');
}

function emitir(status: string, inboxId: string = INBOX_ID) {
  window.dispatchEvent(
    new CustomEvent('evolution:hubChannelConnection', {
      detail: { inbox_id: inboxId, connection_status: status },
    }),
  );
}

describe('HubConnectButton — estado real da conexão', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  it('sai de "Aguardando" para conectado ao receber o evento do Hub', async () => {
    await criarInbox();

    emitir('connected');

    await waitFor(() => expect(screen.getByTestId('hub-connected')).toBeInTheDocument());
    expect(screen.queryByTestId('hub-waiting')).not.toBeInTheDocument();
  });

  it('ignora evento de outra inbox', async () => {
    await criarInbox();

    emitir('connected', 'inbox-outra');

    await waitFor(() => expect(screen.getByTestId('hub-waiting')).toBeInTheDocument());
    expect(screen.queryByTestId('hub-connected')).not.toBeInTheDocument();
  });

  it('volta para aguardando quando o Hub desconecta o canal', async () => {
    await criarInbox();
    emitir('connected');
    await screen.findByTestId('hub-connected');

    emitir('disconnected');

    await waitFor(() => expect(screen.getByTestId('hub-waiting')).toBeInTheDocument());
  });
});
