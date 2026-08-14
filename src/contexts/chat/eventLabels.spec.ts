import { describe, it, expect } from 'vitest';
import { mapEventLabels } from './eventLabels';

const CREATED_AT = '2026-08-14T10:00:00Z';
const UPDATED_AT = '2026-08-14T11:00:00Z';

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

  it('passa na guarda de merge do ChatContext (title && color)', () => {
    const result = mapEventLabels([{ id: 'a1', title: 'urgente', color: '#ff0000' }], [], CREATED_AT, UPDATED_AT);

    expect(result.every((label) => Boolean(label.title) && Boolean(label.color))).toBe(true);
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
