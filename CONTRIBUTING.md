# Contributing to the Mvua Publisher

Thank you for helping build open insurance infrastructure. This document is the contract between you and the maintainers: follow it and reviews are fast.

## Code of conduct

By participating you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Development setup

1. Install Node 24 (the pinned version is in `.nvmrc`; run `nvm use`). The `engines` field in `package.json` enforces it.
2. `npm ci` installs the exact locked dependency set. Use `npm ci`, not `npm install`, unless you are deliberately changing dependencies.
3. `npm run build && npm test` must pass before you start changing things, so you know your baseline is green.

## How we work

- **Trunk based development.** `main` is always green and deployable. Branch from `main`, open a PR back to `main`.
- **Branch naming:** `feat/<topic>`, `fix/<topic>`, `chore/<topic>`, `docs/<topic>`, `test/<topic>`.
- **Commits are conventional:** `type(scope): imperative subject`. Types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `ci`, `build`. Example: `feat(sources): add Open-Meteo archive fetcher`. Subject at most 72 characters.
- **One logical change per PR.** A bug fix PR does not also reformat the codebase.
- **Every PR needs tests.** A fix without the test that would have caught the bug is not done.
- **CI must be green.** No exceptions, including for maintainers.

## Service standards (the short version)

- **No secrets in code.** Signing keys and endpoints come from the environment, validated at startup (see `src/config.ts`). Nothing sensitive is logged.
- **The observation schema is a hard contract with the chain.** The XDR that `src/schema/observation.ts` produces must byte for byte match what the `oracle-adapter` contract reconstructs and verifies. Any change to the payload shape is a breaking, cross repository change: update the golden fixture test and coordinate with `mvua-contract`.
- **Determinism at the boundary.** Given the same source rows, normalization must produce the same signed payload. No wall clock or locale dependence in the value path.
- **Fail closed.** When a source is unreachable, a value fails validation, or config is incomplete, do not submit. A missing observation is safe; a wrong one is not.
- **Exact dependency pinning.** Versions are pinned (no `^` or `~`); the lockfile is committed. Bumping anything is a decision record (see the contracts and context repositories, DR-0005).
- Public functions and exported types carry doc comments; the value path has no `any`.

## PR checklist

- [ ] Conventional commit title and history
- [ ] Tests cover new behavior; `npm test` passes
- [ ] `npm run lint`, `npm run format:check`, and `npm run typecheck` pass
- [ ] The XDR golden fixture test passes (schema unchanged) or is updated with a matching `mvua-contract` reference (schema changed)
- [ ] Docs updated, including `CHANGELOG.md` under `[Unreleased]`
- [ ] No new unpinned dependencies (exact versions only, lockfile committed)
- [ ] No secrets, no personal data in the diff

## Reporting issues

- Bugs: use the bug report template. Include the Node version, commit or tag, and steps.
- Vulnerabilities: **never** in public issues. See [SECURITY.md](./SECURITY.md).
- Ideas: use the feature request template. Explain the problem first, then the solution.

## Licensing

By contributing you agree your contributions are licensed under the [MIT License](./LICENSE).
