# Contributing to Evo CRM Frontend

Thanks for your interest in contributing to Evo CRM Frontend! This document
outlines how to contribute effectively.

## Code of Conduct

All contributors are expected to be respectful, inclusive, and professional.
Harassment, discrimination, or abusive behavior will not be tolerated.

## How to Contribute

### Reporting Bugs

1. Check existing [issues](https://github.com/evolution-foundation/evo-ai-frontend-community/issues)
   to avoid duplicates
2. Open a new issue with:
   - Clear, descriptive title
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, version, dependencies)
   - Logs or screenshots when relevant

### Suggesting Features

1. Open an issue describing:
   - The problem you're trying to solve
   - Your proposed solution
   - Alternatives you considered
2. Wait for maintainer feedback before starting implementation

### Submitting Pull Requests

1. Fork the repository
2. Create a feature branch from `develop`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
3. Make your changes following the project's coding standards
4. Write or update tests for your changes
5. Ensure all tests pass and the code lints clean
6. Commit using [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   feat: add new feature
   fix: resolve bug in X
   docs: update README
   refactor: simplify Y
   test: add coverage for Z
   ```
7. Push to your fork and open a PR against `develop`
8. Fill out the PR template with context, testing notes, and screenshots if
   applicable

## Development Setup

See [README.md](./README.md) for project-specific setup instructions.

## Code Standards

- Follow the existing code style of the project
- Run linters and formatters before committing
- Add tests for new features and bug fixes
- Document public APIs and non-obvious behavior
- Keep commits atomic and focused

### The lint baseline

`eslint-suppressions.json` records the lint debt this repository already
carried when the `ESLint (diff)` gate was introduced — per file, per rule, as a
count. ESLint applies it automatically; you do not pass a flag to opt in.

It exists so the gate fails you for violations **you** wrote, not for whatever
was already in a file you happened to touch. Practically:

- **Touching a file with old errors is fine.** Nothing to do.
- **Adding a violation fails the gate**, as it always has. When the rule already
  has a baseline entry for that file, ESLint reports *every* occurrence in the
  file, not only the new one — yours is the one in your diff.
- **Fixing an old violation** leaves the baseline overstated, and ESLint exits 2
  ("There are suppressions left that do not occur anymore"). Run
  `npx eslint --prune-suppressions src` and commit the result. CI will not block
  you on this — it prints a reminder — but the baseline only shrinks if someone
  commits the prune, and shrinking it is the point.

Two things that surprise people:

- **Renaming a file loses its entry.** The baseline is keyed by path, so a
  renamed file arrives with its whole backlog looking brand new. Re-key it with
  `npx eslint --suppress-all <new path>`, which touches only that file.
- **Pruning the whole tree can sweep up more than your PR.** Debt paid in
  earlier PRs where nobody pruned shows up in your diff. That is expected — it
  is catch-up, not a mistake.

After bumping ESLint or its plugins, regenerate the baseline
(`npx eslint --suppress-all src`): new rules and fixed false positives move the
counts in both directions.

## Branch Strategy

- `main` — stable production-ready code
- `develop` — integration branch for upcoming releases
- `feat/*`, `fix/*`, `chore/*` — short-lived branches off `develop`

## Trademark Notice

By contributing, you agree that your contributions will be licensed under the
Apache License 2.0 (see [LICENSE](./LICENSE)). Trademarks and brand assets are
governed separately by [TRADEMARKS.md](./TRADEMARKS.md).

## Questions?

- **Community**: [evolutionfoundation.com.br/community](https://evolutionfoundation.com.br/community)
- **Documentation**: [docs.evolutionfoundation.com.br](https://docs.evolutionfoundation.com.br)
- **Email**: suporte@evofoundation.com.br

Thanks for helping make Evo CRM Frontend better!

---

© 2026 Evolution Foundation
