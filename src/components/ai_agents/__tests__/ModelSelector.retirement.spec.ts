import { describe, it, expect } from 'vitest';
import { availableModels } from '@/components/ai_agents/ModelSelector';

/**
 * The one rule the pinned list cannot enforce on its own: an id whose end of service the
 * provider has already dated must be gone by that date. The axes that list live are
 * corrected the moment a key is chosen; vertex and perplexity never are, so this table is
 * the only thing that ever notices. Deliberately offline, so a guard whose whole job is
 * watching a date runs on every PR — the network specs are out of CI.
 *
 * Serving an id until its date is the posture, not an oversight: pulling it early costs
 * the user a model that still answers. CRM-462 wrote that down for the perplexity axis.
 */

// End-of-service dates, as the provider published them. A row is added when a pin gains a
// dated shutdown and dropped when the id leaves the list.
//
// Bedrock is absent on purpose: its `Model EOL date` is a floor ("No sooner than …"), not
// an expiry, so it is no deadline to assert. That axis reads the live lifecycle instead,
// in ModelSelector.bedrockLifecycle.spec.ts.
const RETIRES_ON: Record<string, string> = {
  // Perplexity supports Sonar Chat Completions until this date; CRM-462 owns the move to
  // the Agent API, and this is its "or the axis is emptied" half.
  'perplexity/sonar': '2026-09-27',
  'perplexity/sonar-pro': '2026-09-27',
  'perplexity/sonar-reasoning-pro': '2026-09-27',
  'perplexity/sonar-deep-research': '2026-09-27',
  // Vertex retires the whole Gemini 2.5 family. Pro has no GA successor to pin yet
  // (3.1 Pro is still Preview), which is exactly why the date needs a guard.
  'vertex_ai/gemini-2.5-pro': '2026-10-16',
};

// Compared as calendar days in UTC: a date is reached the moment any timezone is on it,
// and a guard that fires a few hours early costs nothing next to one that fires late.
const today = () => new Date().toISOString().slice(0, 10);

describe('announced retirements', () => {
  it('offers no id whose end-of-service date has arrived', () => {
    const expired = Object.entries(RETIRES_ON)
      .filter(([value]) => availableModels.some(m => m.value === value))
      .filter(([, date]) => date <= today())
      .map(([value, date]) => `${value} (retired ${date})`);
    expect(expired).toEqual([]);
  });

  it('dates only ids the list still carries, so a removal cleans the table too', () => {
    const orphaned = Object.keys(RETIRES_ON).filter(
      value => !availableModels.some(m => m.value === value),
    );
    expect(orphaned).toEqual([]);
  });

  it('reads every date in the shape it compares', () => {
    const malformed = Object.entries(RETIRES_ON)
      .filter(([, date]) => !/^\d{4}-\d{2}-\d{2}$/.test(date))
      .map(([value]) => value);
    expect(malformed).toEqual([]);
  });
});
