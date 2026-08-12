import { describe, expect, it, vi, beforeEach } from 'vitest';
import { toast } from 'sonner';
import { useChannelValidation } from './useChannelValidation';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

// Every guard in useChannelValidation toasts before returning false, except one:
// picking "whatsapp" with no provider selected returned false silently (CRM-114) —
// the create button did nothing visible.
describe('validateByChannelAndProvider — whatsapp without a provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('toasts and fails validation instead of exiting silently', () => {
    const { validateByChannelAndProvider } = useChannelValidation();

    const result = validateByChannelAndProvider('whatsapp', undefined, {});

    expect(result).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('Selecione um provedor');
  });
});
