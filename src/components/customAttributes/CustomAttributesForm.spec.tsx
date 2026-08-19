import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CustomAttributesForm from './CustomAttributesForm';

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const mockGetCustomAttributes = vi.fn();
vi.mock('@/services/customAttributes/customAttributesService', () => ({
  customAttributesService: {
    getCustomAttributes: (...args: unknown[]) => mockGetCustomAttributes(...args),
  },
}));

// CRM-166: a 403 on the definitions endpoint was swallowed and rendered as "no
// attributes". The paired empty-catalog cases keep the failure assertions honest —
// a panel rendered unconditionally would satisfy them too.
describe('CustomAttributesForm — load failure is not "no attributes" (CRM-166)', () => {
  const definition = {
    id: 'def-1',
    attribute_display_name: 'Plano contratado',
    attribute_key: 'plano_contratado',
    attribute_display_type: 'text',
    attribute_model: 'contact_attribute',
    attribute_description: null,
  };

  const definitions = (data: unknown[]) => ({ data, meta: {} });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('editable mode (contact sidebar)', () => {
    const renderEditable = () =>
      render(
        <CustomAttributesForm
          attributeModel="contact_attribute"
          attributes={{ plano_contratado: 'Pro' }}
          mode="editable"
          onUpdateAttributes={vi.fn()}
        />,
      );

    it('reports the failure instead of the empty state when the definitions do not load', async () => {
      mockGetCustomAttributes.mockRejectedValue(new Error('Request failed with status code 403'));

      renderEditable();

      await waitFor(() => {
        expect(screen.getByText('customAttributes.loadFailed.title')).toBeInTheDocument();
      });
      expect(
        screen.queryByText('contactSidebar.customAttributes.noAttributes'),
      ).not.toBeInTheDocument();
    });

    it('still reports a genuinely empty catalog as the empty state', async () => {
      mockGetCustomAttributes.mockResolvedValue(definitions([]));

      renderEditable();

      await waitFor(() => {
        expect(
          screen.getByText('contactSidebar.customAttributes.noAttributes'),
        ).toBeInTheDocument();
      });
      expect(screen.queryByText('customAttributes.loadFailed.title')).not.toBeInTheDocument();
    });

    it('retries the load and renders the attributes once the request succeeds', async () => {
      mockGetCustomAttributes
        .mockRejectedValueOnce(new Error('Request failed with status code 403'))
        .mockResolvedValueOnce(definitions([definition]));

      renderEditable();

      await waitFor(() => {
        expect(screen.getByText('customAttributes.loadFailed.title')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: 'customAttributes.loadFailed.retry' }));

      await waitFor(() => {
        expect(screen.getByText('Plano contratado')).toBeInTheDocument();
      });
      expect(screen.queryByText('customAttributes.loadFailed.title')).not.toBeInTheDocument();
      expect(mockGetCustomAttributes).toHaveBeenCalledTimes(2);
    });
  });

  describe('form mode (contact edit form)', () => {
    const renderForm = (attributes: Record<string, unknown> = {}) =>
      render(
        <CustomAttributesForm
          attributeModel="contact_attribute"
          attributes={attributes}
          mode="form"
          onAttributesChange={vi.fn()}
        />,
      );

    it('reports the failure instead of the "no attributes registered" empty state', async () => {
      mockGetCustomAttributes.mockRejectedValue(new Error('Request failed with status code 403'));

      renderForm();

      await waitFor(() => {
        expect(screen.getByText('customAttributes.loadFailed.title')).toBeInTheDocument();
      });
      expect(screen.queryByText('empty.title')).not.toBeInTheDocument();
    });

    it('still shows the empty state when the catalog really is empty', async () => {
      mockGetCustomAttributes.mockResolvedValue(definitions([]));

      renderForm();

      await waitFor(() => {
        expect(screen.getByText('empty.title')).toBeInTheDocument();
      });
      expect(screen.queryByText('customAttributes.loadFailed.title')).not.toBeInTheDocument();
    });

    // The edit form kept working through the bug because values with no definition
    // fall through to the ad-hoc section, which the failure panel must not replace.
    it('keeps rendering the ad-hoc values while the definitions are unavailable', async () => {
      mockGetCustomAttributes.mockRejectedValue(new Error('Request failed with status code 403'));

      renderForm({ plano_contratado: 'Pro' });

      await waitFor(() => {
        expect(screen.getByText('customAttributes.loadFailed.title')).toBeInTheDocument();
      });
      expect(screen.getByText('plano_contratado')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Pro')).toBeInTheDocument();
    });

    // Needs the surrounding <form>: rendered standalone the component satisfies every
    // case above even while the retry is submitting ContactForm instead of refetching.
    it('does not submit the surrounding form when retrying', async () => {
      mockGetCustomAttributes.mockRejectedValue(new Error('Request failed with status code 403'));
      const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());

      render(
        <form onSubmit={onSubmit}>
          <CustomAttributesForm
            attributeModel="contact_attribute"
            attributes={{}}
            mode="form"
            onAttributesChange={vi.fn()}
          />
        </form>,
      );

      await waitFor(() => {
        expect(screen.getByText('customAttributes.loadFailed.title')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: 'customAttributes.loadFailed.retry' }));

      expect(onSubmit).not.toHaveBeenCalled();
      expect(mockGetCustomAttributes).toHaveBeenCalledTimes(2);
    });
  });
});
