import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HubConnectButton from './HubConnectButton';
import { api } from '@/services/core';
import hubApi from '@/services/core/api';

vi.mock('@/services/core', () => ({
  api: { post: vi.fn(), get: vi.fn() },
}));

// evolutionHubService importa o axios pelo caminho do módulo, não pelo barrel,
// então o mock acima não o alcança — sem este, o serviço sai batendo na rede.
vi.mock('@/services/core/api', () => ({
  default: { post: vi.fn(), get: vi.fn(), delete: vi.fn() },
}));

// useGlobalConfig returns the config flat (GlobalConfigContextValue extends
// GlobalConfig), so the mock has to be flat too — a nested { config } shape
// leaves hubAllowExistingChannels undefined and silently enables the mode.
vi.mock('@/contexts/GlobalConfigContext', () => ({
  useGlobalConfig: () => ({ hubAllowExistingChannels: false, setupRequired: false, setupLoading: false }),
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

async function emitir(status: string, inboxId: string = INBOX_ID) {
  await act(async () => {
    window.dispatchEvent(
      new CustomEvent('evolution:hubChannelConnection', {
        detail: { inbox_id: inboxId, connection_status: status },
      }),
    );
  });
}

// A Meta devolve o desfecho do signup por postMessage, da origem dela; o
// componente ignora qualquer outra.
async function emitirMeta(event: string) {
  await act(async () => {
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://www.facebook.com',
        data: JSON.stringify({ type: 'WA_EMBEDDED_SIGNUP', event }),
      }),
    );
  });
}

describe('HubConnectButton — estado real da conexão', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  it('sai de "Aguardando" para conectado ao receber o evento do Hub', async () => {
    await criarInbox();

    await emitir('connected');

    await waitFor(() => expect(screen.getByTestId('hub-connected')).toBeInTheDocument());
    expect(screen.queryByTestId('hub-waiting')).not.toBeInTheDocument();
    expect(toastSuccess).toHaveBeenCalledWith('Canal conectado.');
  });

  it('ignora evento de outra inbox', async () => {
    await criarInbox();

    await emitir('connected', 'inbox-outra');

    await waitFor(() => expect(screen.getByTestId('hub-waiting')).toBeInTheDocument());
    expect(screen.queryByTestId('hub-connected')).not.toBeInTheDocument();
  });

  it('volta para aguardando quando o Hub desconecta o canal', async () => {
    await criarInbox();
    await emitir('connected');
    await screen.findByTestId('hub-connected');

    await emitir('disconnected');

    await waitFor(() => expect(screen.getByTestId('hub-waiting')).toBeInTheDocument());
  });

  // O broadcast se perde se o socket estava fora quando o Hub avisou; a volta
  // para a aba tem que resolver o estado sem refresh manual.
  it('reconcilia pelo GET da inbox quando o evento do ActionCable se perdeu', async () => {
    await criarInbox();
    vi.mocked(api.get).mockResolvedValue({
      data: { data: { id: INBOX_ID, connection_state: 'connected', health_source: 'provider_event' } },
    } as never);

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(screen.getByTestId('hub-connected')).toBeInTheDocument());
    expect(api.get).toHaveBeenCalledWith(`/inboxes/${INBOX_ID}`);
  });

  // `stored_flag` é o resolver ASSUMINDO que um canal token-based configurado
  // está vivo — não é confirmação do Hub, e não pode declarar conectado.
  it('nao declara conectado quando o estado veio de stored_flag', async () => {
    await criarInbox();
    vi.mocked(api.get).mockResolvedValue({
      data: { data: { id: INBOX_ID, connection_state: 'connected', health_source: 'stored_flag' } },
    } as never);

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.getByTestId('hub-waiting')).toBeInTheDocument();
  });
});

// O canal no Hub nasce antes de o operador chegar na Meta, então uma tentativa
// que termina em cancelamento ou erro precisa derrubar a inbox: o órfão
// consome cota do plano e aparece na lista como uma conexão que nunca houve.
describe('HubConnectButton — descarte da conexão que não concluiu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.mocked(hubApi.delete).mockResolvedValue({} as never);
  });

  it('descarta a inbox que acabou de criar quando a Meta cancela', async () => {
    await criarInbox();

    await emitirMeta('CANCEL');

    expect(hubApi.delete).toHaveBeenCalledWith(`/inboxes/${INBOX_ID}/hub_connection`);
  });

  it('descarta também quando a Meta recusa a conexão', async () => {
    await criarInbox();

    await emitirMeta('ERROR');

    expect(hubApi.delete).toHaveBeenCalledWith(`/inboxes/${INBOX_ID}/hub_connection`);
  });

  // O link público morre junto com o canal no Hub: reabri-lo levaria o
  // operador para uma página que não existe mais.
  it('oferece recomeçar no lugar do link morto depois do descarte', async () => {
    await criarInbox();

    await emitirMeta('CANCEL');

    expect(await screen.findByRole('button', { name: /tentar de novo/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /outra aba/i })).not.toBeInTheDocument();
  });

  it('nunca descarta uma conexão que já entrou', async () => {
    await criarInbox();
    await emitir('connected');
    await screen.findByTestId('hub-connected');

    await emitirMeta('CANCEL');

    expect(hubApi.delete).not.toHaveBeenCalled();
  });

  it('não trava a tela quando o próprio descarte falha', async () => {
    vi.mocked(hubApi.delete).mockRejectedValue(new Error('canal já conectado'));
    await criarInbox();

    await emitirMeta('CANCEL');

    // Segue na tela de falha, com saída: a inbox pendente continua visível e
    // apagável pela listagem, que roda a mesma limpeza.
    expect(await screen.findByTestId('hub-failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /outra aba/i })).toBeInTheDocument();
  });
});
