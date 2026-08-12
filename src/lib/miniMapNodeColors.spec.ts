import { describe, it, expect } from 'vitest';
import { createMiniMapNodeColors } from './utils';
import manifest from '@/pages/Customer/Journey/journey-node-manifest.json';

// createMiniMapNodeColors' defaultColors had drifted from the real node types:
// 2 keys for types that don't exist (dead), ~15 real types missing (silently
// falling back to var(--color-muted-foreground) in BaseFlowCanvas). This pins
// its keys to exactly journey-node-manifest.json's nodeTypes — the same
// cross-repo contract journey-node-manifest.spec.ts already guards.
describe('createMiniMapNodeColors — parity with journey-node-manifest.json', () => {
  it('has exactly one color per node type in the manifest, no extras', () => {
    const defaultColors = createMiniMapNodeColors();
    expect(Object.keys(defaultColors).sort()).toEqual([...manifest.nodeTypes].sort());
  });

  it('every default color is a non-empty hex string', () => {
    const defaultColors = createMiniMapNodeColors();
    for (const [nodeType, color] of Object.entries(defaultColors)) {
      expect(color, `color for ${nodeType}`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('still lets a caller override a color without losing the rest', () => {
    const colors = createMiniMapNodeColors({ 'wait-node': '#000000' });
    expect(colors['wait-node']).toBe('#000000');
    expect(colors['add-label-node']).toBeTruthy();
  });
});
