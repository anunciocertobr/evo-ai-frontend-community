import { describe, it, expect } from 'vitest';
import { mapEventLabels } from './eventLabels';

const CREATED_AT = '2026-08-14T10:00:00Z';
const UPDATED_AT = '2026-08-14T11:00:00Z';

// Cobre o mapper. O merge em si (ChatContext.tsx:487-504 — a guarda `title && color`
// e o override com lista vazia) não é unit-testável sem montar o provider inteiro;
// os ACs de tela ficam no teste manual do card.
describe('mapEventLabels (CRM-155)', () => {
  it('usa labels_data e entrega título e cor de verdade', () => {
    const result = mapEventLabels(
      [{ id: 'a1', title: 'urgente', color: '#ff0000' }],
      ['urgente'],
      CREATED_AT,
      UPDATED_AT
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a1');
    expect(result[0].title).toBe('urgente');
    expect(result[0].color).toBe('#ff0000');
  });

  it('labels_data manda, mesmo quando é mais curto que labels (tag órfã)', () => {
    const result = mapEventLabels(
      [{ id: 'a1', title: 'urgente', color: '#ff0000' }],
      ['urgente', 'b0b0b0b0-0000-0000-0000-000000000000'],
      CREATED_AT,
      UPDATED_AT
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a1');
  });

  it('converte timestamp epoch do evento sem deixar número onde o tipo diz string', () => {
    const result = mapEventLabels([{ id: 'a1', title: 'urgente', color: '#ff0000' }], [], 1755172800, 1755176400);

    expect(typeof result[0].created_at).toBe('string');
    expect(result[0].created_at).toBe('1755172800');
  });

  it('devolve lista vazia quando labels_data vem vazio — remoção tem que refletir', () => {
    expect(mapEventLabels([], ['urgente'], CREATED_AT, UPDATED_AT)).toEqual([]);
  });

  it('cai no fallback de títulos quando o backend ainda não manda labels_data', () => {
    const result = mapEventLabels(undefined, ['urgente'], CREATED_AT, UPDATED_AT);

    expect(result[0].id).toBe('urgente');
    expect(result[0].title).toBe('urgente');
    expect(result[0].color).toBe('');
  });

  it('aceita objeto no campo antigo sem perder id, título e cor', () => {
    const result = mapEventLabels(
      undefined,
      [{ id: 'a1', title: 'urgente', color: '#ff0000', show_on_sidebar: true }],
      CREATED_AT,
      UPDATED_AT
    );

    expect(result[0]).toMatchObject({ id: 'a1', title: 'urgente', color: '#ff0000', show_on_sidebar: true });
  });

  it('não quebra quando o payload não traz nenhum dos dois campos', () => {
    expect(mapEventLabels(undefined, undefined, CREATED_AT, UPDATED_AT)).toEqual([]);
  });
});
