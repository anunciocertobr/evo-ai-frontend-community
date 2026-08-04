import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AgentsFilterPanel from './AgentsFilterPanel';
import {
  EMPTY_AGENT_FACETS,
  applyAgentFacets,
  buildModelOptions,
  countSelectedFacets,
} from './agentsFilterFacets';
import type { Agent } from '@/types/agents';

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (key: string) => key, currentLanguage: 'pt-BR' }),
}));

const AGENTS = [
  { id: '1', name: 'A', type: 'llm', model: 'openai/gpt-4o' },
  { id: '2', name: 'B', type: 'external', model: 'openai/gpt-4o' },
  { id: '3', name: 'C', type: 'sequential', model: 'anthropic/claude' },
  { id: '4', name: 'D', type: 'a2a', model: '' },
] as unknown as Agent[];

const renderPanel = (overrides: Partial<Parameters<typeof AgentsFilterPanel>[0]> = {}) => {
  const props = {
    open: true,
    onClose: vi.fn(),
    selection: EMPTY_AGENT_FACETS,
    onSelectionChange: vi.fn(),
    onClear: vi.fn(),
    modelOptions: ['gpt-4o', 'claude'],
    ...overrides,
  };
  render(<AgentsFilterPanel {...props} />);
  return props;
};

beforeEach(() => vi.clearAllMocks());

describe('agentsFilterFacets', () => {
  it('derives model options from the loaded agents, provider prefix stripped', () => {
    expect(buildModelOptions(AGENTS)).toEqual(['claude', 'gpt-4o']);
  });

  it('groups a2a and the orchestrators under Avançado', () => {
    const advanced = applyAgentFacets(AGENTS, { type: ['advanced'], model: [] });
    expect(advanced.map(a => a.id)).toEqual(['3', '4']);
  });

  it('keeps Nativo and Externo on their own single type', () => {
    expect(applyAgentFacets(AGENTS, { type: ['native'], model: [] }).map(a => a.id)).toEqual(['1']);
    expect(applyAgentFacets(AGENTS, { type: ['external'], model: [] }).map(a => a.id)).toEqual([
      '2',
    ]);
  });

  it('intersects type and model instead of unioning them', () => {
    const result = applyAgentFacets(AGENTS, { type: ['native'], model: ['gpt-4o'] });
    expect(result.map(a => a.id)).toEqual(['1']);
  });

  it('returns everything when nothing is selected', () => {
    expect(applyAgentFacets(AGENTS, EMPTY_AGENT_FACETS)).toHaveLength(4);
  });

  it('counts both axes for the button badge', () => {
    expect(countSelectedFacets({ type: ['native'], model: ['gpt-4o', 'claude'] })).toBe(3);
  });
});

describe('AgentsFilterPanel', () => {
  it('renders the two sections from the prototype, open by default', () => {
    renderPanel();
    expect(screen.getByText('filters.sections.type')).toBeTruthy();
    expect(screen.getByText('filters.sections.model')).toBeTruthy();
    expect(screen.getByText('filters.types.native')).toBeTruthy();
    expect(screen.getByText('filters.types.external')).toBeTruthy();
    expect(screen.getByText('filters.types.advanced')).toBeTruthy();
  });

  it('says so when a section has no option instead of rendering an empty box', () => {
    renderPanel({ modelOptions: [] });
    expect(screen.getByText('filters.empty')).toBeTruthy();
  });

  it('collapses a section when its header is clicked', async () => {
    renderPanel();
    await userEvent.click(screen.getByText('filters.sections.type'));
    expect(screen.queryByText('filters.types.native')).toBeNull();
    expect(screen.getByText('filters.sections.model')).toBeTruthy();
  });

  it('reports the toggled option back to the parent', async () => {
    const props = renderPanel();
    await userEvent.click(screen.getByText('filters.types.advanced'));
    expect(props.onSelectionChange).toHaveBeenCalledWith({ type: ['advanced'], model: [] });
  });

  it('unchecks an option that is already selected', async () => {
    const props = renderPanel({ selection: { type: ['native'], model: [] } });
    await userEvent.click(screen.getByText('filters.types.native'));
    expect(props.onSelectionChange).toHaveBeenCalledWith({ type: [], model: [] });
  });

  it('marks the selected option as checked for assistive tech', () => {
    renderPanel({ selection: { type: ['native'], model: [] } });
    const checked = screen.getAllByRole('checkbox').filter(el => el.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(1);
  });

  it('clears every axis from the footer', async () => {
    const props = renderPanel({ selection: { type: ['native'], model: ['gpt-4o'] } });
    await userEvent.click(screen.getByText('filters.clear'));
    expect(props.onClear).toHaveBeenCalledTimes(1);
  });

  it('renders nothing while closed', () => {
    renderPanel({ open: false });
    expect(screen.queryByText('filters.title')).toBeNull();
  });

  it('closes on a click outside', () => {
    const props = renderPanel();
    fireEvent.mouseDown(document.body);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close on a click inside the panel', () => {
    const props = renderPanel();
    fireEvent.mouseDown(screen.getByText('filters.sections.type'));
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('closes on Escape', () => {
    const props = renderPanel();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
