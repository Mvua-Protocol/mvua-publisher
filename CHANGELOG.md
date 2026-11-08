# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Repository governance baseline: README, contributing guide, security policy, code of conduct, MIT license, issue and pull request templates, and CI (typecheck, lint, format, build, test, dependency audit, commit lint, and secret scanning), mirroring `mvua-contract` for a Node 24 TypeScript service.
- Pinned toolchain and dependency set: Node 24 (`.nvmrc`, `engines`), TypeScript strict configuration, ESLint and Prettier, and exact-version dependencies (`@stellar/stellar-sdk`, `tweetnacl`, `zod`) with the lockfile to be committed on first install.
- Publisher service scaffold (Sprint 2.1, P2.1.1): a one-shot run that fetches a day of rainfall from Open-Meteo (primary) and NOAA GHCN-Daily (cross-check), normalizes and corroborates them, scales the value to the on-chain integer, ed25519-signs the XDR of `ObservationPayload { region, metric, timestamp, value }`, and submits it to `oracle-adapter.submit` on testnet. Fails closed on any unreachable source, failed validation, or source disagreement.
- Shared observation schema (P2.1.3 seed): `src/schema/observation.ts` reconstructs the contract's `#[contracttype]` payload as a sorted `ScVal` map and serializes it to XDR, with a golden fixture test (`test/observation.xdr.test.ts`) whose expected bytes are cross-checked against the Rust `to_xdr` reference so the off-chain signer and on-chain verifier cannot silently diverge.
- Startup configuration and secret handling (P2.1.2 seed): `src/config.ts` validates every environment variable with `zod` and separates the ed25519 publisher signing identity from the fee-paying transaction submitter; `.env.example` documents the full contract.
- README links the live testnet `oracle-adapter` this publisher feeds and the site's testnet deployment page, where the first settled season is recorded.

### Security

- `zod` pin raised from `3.24.1` to `4.6.7` to clear GHSA-mrhx-c7xc-m3w5 (memory exhaustion validating oversized constrained collections, fixed only in 4.6.6 and later). The configuration schema in `src/config.ts` needed no changes; behavior is unchanged (DR-0034).
- Lockfile refresh moves the transitive `follow-redirects` (via `@stellar/stellar-sdk` and `axios`) from `1.16.0` to `1.16.2`, clearing three high severity credential header advisories (GHSA-q3jh-wrc6-jgq8, GHSA-8r9p-f939-6h3c, GHSA-mrwp-f3q8-3g9p).
