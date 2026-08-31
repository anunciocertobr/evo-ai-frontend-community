import { describe, it, expect, beforeAll } from 'vitest';
import { availableModels } from '@/components/ai_agents/ModelSelector';

/**
 * Freshness for the bedrock axis, which the sibling shape spec cannot cover.
 *
 * Bedrock has no listing endpoint the product can reach, so the pinned list is
 * the only source for this axis and nothing corrects it on its own. The AWS docs
 * do serve each model card as raw markdown — swap `.html` for `.md` — carrying
 * `Model lifecycle` and `Model EOL date` in plain text, with no credentials. That
 * is enough to check the pins against the provider instead of against a memory.
 *
 * It is what would have caught Llama 3.1 405B, which sat in the picker for weeks
 * after going Legacy: being listed in the model-card index says nothing about
 * lifecycle, and the index does not drop a retired model.
 *
 * NOT in the CI list on purpose — it reaches the network, so it is neither fast
 * nor deterministic, the two things that list asks of a spec. Run it by hand when
 * touching the axis, or on the EOL dates the entries carry.
 */

const DOCS_BASE = 'https://docs.aws.amazon.com/bedrock/latest/userguide';

// Bedrock ids carry a routing prefix (`global.`, `us.`) that the model card slug
// does not, and the slug follows the model's marketing name rather than its id —
// `us.meta.llama3-1-70b-instruct-v1:0` lives in `model-card-meta-llama-3-1-70b-instruct`.
// No rule derives one from the other, so the pairing is written down. An id with no
// entry here fails the first example rather than being quietly skipped.
const MODEL_CARD_BY_ID: Record<string, string> = {
  'bedrock/global.anthropic.claude-opus-5': 'model-card-anthropic-claude-opus-5',
  'bedrock/global.anthropic.claude-sonnet-5': 'model-card-anthropic-claude-sonnet-5',
  'bedrock/global.anthropic.claude-sonnet-4-5-20250929-v1:0': 'model-card-anthropic-claude-sonnet-4-5',
  'bedrock/us.meta.llama3-1-70b-instruct-v1:0': 'model-card-meta-llama-3-1-70b-instruct',
  'bedrock/us.deepseek.r1-v1:0': 'model-card-deepseek-deepseek-r1',
  'bedrock/mistral.mistral-7b-instruct-v0:2': 'model-card-mistral-ai-mistral-7b-instruct',
  'bedrock/amazon.nova-micro-v1:0': 'model-card-amazon-nova-micro',
};

const bedrockEntries = availableModels.filter(m => m.provider === 'bedrock');

const modelId = (value: string) => value.replace(/^bedrock\//, '');

const lifecycleOf = (markdown: string) =>
  markdown.match(/\*\*Model lifecycle:\*\*\s*(.+)/)?.[1].trim();

const eolNoticeOf = (markdown: string) =>
  markdown.match(/\*\*Model EOL date:\*\*\s*(.+)/)?.[1].trim();

// `Model EOL date` is a FLOOR, not an expiry: "No sooner than 3/1/2025" promises the
// model will not be retired BEFORE that day, and says nothing about after. Four of the
// pins here sit past their floor and are served normally, so treating the date as an
// expiry — `new Date(notice) < new Date()` — fails them all while AWS is still serving
// them. `Model lifecycle` is the field that actually flips, which is why it is the one
// asserted on.
//
// What the notice is good for is catching a change of vocabulary: these three shapes
// are what the parse above assumes, and a fourth would mean the field started saying
// something this spec cannot read.
const EOL_NOTICE_SHAPES = [
  /^N\/A$/,
  /^No sooner than \d{1,2}\/\d{1,2}\/\d{4}$/,
  /^Legacy: \w+ \d{1,2}, \d{4}$/,
];

const cards = new Map<string, string>();
let docsReachable = true;

beforeAll(async () => {
  try {
    await Promise.all(
      Object.entries(MODEL_CARD_BY_ID).map(async ([id, slug]) => {
        const response = await fetch(`${DOCS_BASE}/${slug}.md`);
        if (!response.ok) {
          throw new Error(`${slug}.md answered ${response.status}`);
        }
        cards.set(id, await response.text());
      }),
    );
  } catch {
    docsReachable = false;
  }
}, 120_000);

describe('bedrock axis lifecycle', () => {
  it('pairs every pinned bedrock id with a model card to check it against', () => {
    const unmapped = bedrockEntries.filter(m => !MODEL_CARD_BY_ID[m.value]).map(m => m.value);
    expect(unmapped).toEqual([]);
  });

  it('checks a non-empty axis, so a silent list rename never reads as a pass', () => {
    expect(bedrockEntries.length).toBeGreaterThan(0);
  });

  it('serves every pinned id from its own model card', ctx => {
    if (!docsReachable) return ctx.skip();

    const missing = Object.entries(MODEL_CARD_BY_ID)
      .filter(([id]) => !cards.get(id)?.includes(modelId(id)))
      .map(([id]) => id);
    expect(missing).toEqual([]);
  });

  it('keeps every pinned id on an Active lifecycle', ctx => {
    if (!docsReachable) return ctx.skip();

    // The lifecycle line is the whole point, so a card that stopped carrying one
    // is reported as such instead of passing on an absent value.
    const notActive = Object.keys(MODEL_CARD_BY_ID)
      .map(id => ({ id, lifecycle: lifecycleOf(cards.get(id) ?? '') }))
      .filter(({ lifecycle }) => lifecycle !== 'Active');
    expect(notActive).toEqual([]);
  });

  it('reads an EOL notice it still knows how to interpret', ctx => {
    if (!docsReachable) return ctx.skip();

    const unreadable = Object.keys(MODEL_CARD_BY_ID)
      .map(id => ({ id, notice: eolNoticeOf(cards.get(id) ?? '') }))
      .filter(({ notice }) => !notice || !EOL_NOTICE_SHAPES.some(shape => shape.test(notice)));
    expect(unreadable).toEqual([]);
  });
});
