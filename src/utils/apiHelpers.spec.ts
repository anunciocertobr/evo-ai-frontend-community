import { describe, it, expect } from 'vitest';
import { apiErrorMessage } from './apiHelpers';

// The envelope every controller renders through
// app/controllers/concerns/api_response_helper.rb#error_response.
function rejection(data: unknown, status = 422) {
  return { response: { status, data }, message: `Request failed with status code ${status}` };
}

describe('apiErrorMessage', () => {
  it('reads the message the backend authored', () => {
    const error = rejection({
      success: false,
      error: { code: 'QUOTA_EXCEEDED', message: 'Limite do plano excedido (5/5) para channels' },
    });

    expect(apiErrorMessage(error)).toBe('Limite do plano excedido (5/5) para channels');
  });

  it('reads the legacy string and bare-message shapes', () => {
    expect(apiErrorMessage(rejection({ error: 'Canal já existe' }))).toBe('Canal já existe');
    expect(apiErrorMessage(rejection({ message: 'Nome é obrigatório' }))).toBe(
      'Nome é obrigatório',
    );
  });

  // Without a message from the server there is nothing better to show than the
  // caller's own localized fallback — "Unprocessable Entity" is not it.
  it('returns undefined when the body carries no message', () => {
    expect(apiErrorMessage(rejection({ whatever: true }))).toBeUndefined();
    expect(apiErrorMessage(rejection(null))).toBeUndefined();
  });

  it('returns undefined for a rejection with no response at all', () => {
    expect(apiErrorMessage(new Error('Network Error'))).toBeUndefined();
  });

  // A catch block can receive anything, and this runs inside error handling —
  // it must not become the failure it is reporting.
  it.each([null, undefined, 'boom', 42])('returns undefined without throwing for %p', value => {
    expect(apiErrorMessage(value)).toBeUndefined();
  });
});
