import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AgentDetailTabs from './AgentDetailTabs';
import { getVisibleAgentTabs } from './agentTabs';

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

const TAB_LABELS = {
  profile: 'edit.menu.profile',
  tools: 'edit.menu.tools',
  products: 'edit.menu.products',
  configuration: 'edit.menu.configuration',
  channels: 'edit.menu.channels',
};

const renderTabs = (agentType: string, onValueChange = vi.fn()) => {
  render(
    <AgentDetailTabs agentType={agentType} value="profile" onValueChange={onValueChange}>
      <div />
    </AgentDetailTabs>
  );
  return onValueChange;
};

describe('getVisibleAgentTabs', () => {
  it('exposes the 5 canonical tabs, in order, for an llm agent', () => {
    expect(getVisibleAgentTabs('llm')).toEqual([
      'profile',
      'tools',
      'products',
      'configuration',
      'channels',
    ]);
  });

  it('omits Ferramentas for external agents', () => {
    expect(getVisibleAgentTabs('external')).toEqual([
      'profile',
      'products',
      'configuration',
      'channels',
    ]);
  });

  it('omits Ferramentas and Produtos for task agents', () => {
    expect(getVisibleAgentTabs('task')).toEqual(['profile', 'configuration', 'channels']);
  });

  it('keeps Ferramentas for flow orchestrators (they still have sub agents)', () => {
    expect(getVisibleAgentTabs('sequential')).toEqual([
      'profile',
      'tools',
      'configuration',
      'channels',
    ]);
  });
});

describe('AgentDetailTabs', () => {
  it('renders the 5 tabs in the canonical order for an llm agent', () => {
    renderTabs('llm');
    const rendered = screen.getAllByRole('tab').map(tab => tab.textContent);
    expect(rendered).toEqual([
      TAB_LABELS.profile,
      TAB_LABELS.tools,
      TAB_LABELS.products,
      TAB_LABELS.configuration,
      TAB_LABELS.channels,
    ]);
  });

  it('does not render the Ferramentas tab for external agents', () => {
    renderTabs('external');
    expect(screen.queryByText(TAB_LABELS.tools)).toBeNull();
    expect(screen.getByText(TAB_LABELS.products)).toBeTruthy();
  });

  it('reports the selected tab back to the parent', async () => {
    const onValueChange = renderTabs('llm');
    await userEvent.click(screen.getByText(TAB_LABELS.configuration));
    expect(onValueChange).toHaveBeenCalledWith('configuration');
  });

  // O TabsTrigger do design-system traz `flex-1` na base e tailwind-merge NÃO o
  // resolve contra `inline-flex` (grupos distintos) — sem um `flex-none` explícito
  // os chips esticam e ocupam a largura toda da barra. Regressão já vista uma vez.
  it('sizes each chip by its content instead of stretching it across the bar', () => {
    renderTabs('llm');
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.className).toContain('flex-none');
      expect(tab.className).not.toContain('flex-1');
    }
  });
});
