import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MessageStatus from './MessageStatus';
import { Message } from '@/types/chat/api';

const toastError = vi.fn();
const toastWarning = vi.fn();
const toastInfo = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (title: string, opts?: { description?: string }) => toastError(title, opts),
    warning: (title: string, opts?: { description?: string }) => toastWarning(title, opts),
    info: (title: string, opts?: { description?: string }) => toastInfo(title, opts),
  },
}));

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

const ERRO_DA_META = '131042: Business eligibility payment issue';

function mensagemFalhada(externalError?: string): Message {
  return {
    id: 'msg-1',
    content: 'oi',
    content_attributes: externalError ? { external_error: externalError } : {},
    content_type: 'text',
    conversation_id: 'conv-1',
    created_at: '2026-08-27T21:00:00Z',
    external_source_ids: {},
    message_type: 1,
    private: false,
    sender: { id: 'user-1', name: 'Agente', type: 'user' },
    source_id: 'wamid.HBgMNTU3NDk5ODc5NDA5',
    status: 'failed',
    attachments: [],
  } as unknown as Message;
}

async function clicarNoIndicador(message: Message) {
  render(<MessageStatus message={message} isOwn />);
  await userEvent.click(screen.getByRole('button'));
}

describe('MessageStatus — mensagem pública que falhou', () => {
  beforeEach(() => {
    toastError.mockClear();
    toastWarning.mockClear();
    toastInfo.mockClear();
  });

  it('mostra o motivo devolvido pelo provedor quando ele existe', async () => {
    await clicarNoIndicador(mensagemFalhada(ERRO_DA_META));

    expect(toastError).toHaveBeenCalledWith(
      'messages.messageStatus.providerRejected',
      expect.objectContaining({ description: ERRO_DA_META }),
    );
    expect(toastWarning).not.toHaveBeenCalled();
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it('cai no texto genérico quando o provedor não devolveu motivo', async () => {
    await clicarNoIndicador(mensagemFalhada());

    expect(toastWarning).toHaveBeenCalled();
    expect(toastInfo).toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it('ignora external_error em branco e trata como sem motivo', async () => {
    await clicarNoIndicador(mensagemFalhada('   '));

    expect(toastWarning).toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });
});
