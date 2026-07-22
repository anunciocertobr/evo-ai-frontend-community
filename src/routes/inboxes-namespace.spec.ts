import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// The backend enforces the Channels surface under the `inboxes.*` catalog
// keys (CRM inboxes_controller and the evolution*/zapi trees). Any frontend
// gate written as `channels.*` guards nothing and inverts the access
// (holders of channels.* see screens that 403; holders of inboxes.* don't
// see them at all). This scan fails when a permission-shaped `channels`
// usage reappears in live code.
const SRC_ROOT = path.resolve(__dirname, '..');

const FORBIDDEN_PATTERNS = [
  /can\(\s*['"]channels['"]/,
  /resource\s*=\s*["']channels["']/,
  /resource:\s*['"]channels['"]/,
  /requiredPermission\s*[:=]\s*['"]channels\./,
  // `bots` never existed in the catalog; its placeholder route was removed.
  /can\(\s*['"]bots['"]/,
  /resource\s*=\s*["']bots["']/,
  /resource:\s*['"]bots['"]/,
];

// Dead-code mirror of the auth catalog, kept until the catalog hygiene pass
// removes the channels resource; it feeds no live gate.
const ALLOWED_FILES = new Set(['config/permissions.ts']);

function collectSourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(full);
    if (!/\.(ts|tsx)$/.test(entry.name)) return [];
    if (/\.(spec|test)\.(ts|tsx)$/.test(entry.name)) return [];
    return [full];
  });
}

describe('channels surface permission namespace', () => {
  it('has no live permission gate keyed on channels.* (must use inboxes.*)', () => {
    const offenders: string[] = [];

    for (const file of collectSourceFiles(SRC_ROOT)) {
      const relative = path.relative(SRC_ROOT, file);
      if (ALLOWED_FILES.has(relative)) continue;

      const content = fs.readFileSync(file, 'utf8');
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(content)) {
          offenders.push(`${relative} matches ${pattern}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
