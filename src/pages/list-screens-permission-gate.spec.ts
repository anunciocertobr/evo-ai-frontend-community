import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// CRM-495: these screens each owned a copy of the same decision — a load-once ref
// read on the first render where permissions were ready — so a verdict that was
// false there stuck until the component remounted. They now share
// `usePermissionGatedLoad`, and that only stays true while nobody re-inlines it.
const PAGES = dirname(fileURLToPath(import.meta.url));

const GATED_SCREENS = [
  'Customer/Agents/CustomMCPServers/CustomMCPServers.tsx',
  'Customer/Agents/CustomTools/CustomTools.tsx',
  'Customer/Agents/MCPServers/MCPServers.tsx',
  'Customer/Agents/Tools/Tools.tsx',
  'Customer/Automation/index.tsx',
  'Customer/Contacts/ScheduledActions.tsx',
  'Customer/Pipelines/Pipelines.tsx',
  'Customer/Settings/AccessTokens/AccessTokens.tsx',
  'Customer/Settings/Integrations/Integrations.tsx',
  'Customer/Settings/Labels/Labels.tsx',
  'Customer/Settings/Macros/Macros.tsx',
  'Customer/Settings/Segments/Segments.tsx',
  'Customer/Settings/Teams/Teams.tsx',
  'Customer/Settings/Users/Users.tsx',
];

// Matches the readiness flag under both spellings in use: the screens read
// `isReady` as `permissionsReady`, the shared hook reads it bare.
const READINESS = /\b(permissionsReady|isReady)\b/;
const LOAD_ONCE_LATCH = /\b\w*(?:hasLoaded|loaded|hasFetched|fetched)\w*\.current\s*=\s*true/i;

const screens = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return screens(path);
    return entry.name.endsWith('.tsx') && !entry.name.endsWith('.spec.tsx') ? [path] : [];
  });

describe('list screens gate their initial load through the shared hook', () => {
  it.each(GATED_SCREENS)('%s calls usePermissionGatedLoad', screen => {
    expect(readFileSync(join(PAGES, screen), 'utf8')).toContain('usePermissionGatedLoad(');
  });

  // Only the ref-latch shape. The other half of the class — the decision latched
  // by an effect whose deps are just the readiness flag, with no ref at all — is
  // still open on ~13 screens and is NOT covered here.
  it('no screen latches the permission decision in a private ref again', () => {
    const offenders = screens(PAGES)
      .filter(path => {
        const source = readFileSync(path, 'utf8');
        return READINESS.test(source) && LOAD_ONCE_LATCH.test(source);
      })
      .map(path => relative(PAGES, path));

    expect(offenders).toEqual([]);
  });
});
