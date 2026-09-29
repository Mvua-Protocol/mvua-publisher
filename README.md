<h1 align="center">Mvua Protocol Publisher</h1>

<p align="center">
  <a href="./.github/workflows/ci.yml"><img src="https://github.com/Mvua-Protocol/mvua-publisher/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/Stellar-testnet-14324e.svg" alt="Network: testnet">
  <img src="https://img.shields.io/badge/node-24-3c873a.svg" alt="Node 24">
</p>

<p align="center">
  <b>The off chain oracle publisher for <a href="https://github.com/Mvua-Protocol/mvua-contract">Mvua Protocol</a>: it turns public weather archives into signed, on chain rainfall observations.</b>
</p>

Mvua pays smallholder farmers automatically when on chain weather data crosses a predefined index trigger. That only works if the weather data on chain is trustworthy. This service is one publisher in the oracle: it fetches a day of rainfall from independent sources, corroborates them, scales the reading to an integer, signs the exact payload the contract will verify, and submits it to the on chain `oracle-adapter`.

> Status: **pre alpha**, in active development. Testnet only. Nothing here is deployed to mainnet.

## This repository in the whole project

Mvua Protocol is built as separate repositories under the [Mvua-Protocol](https://github.com/Mvua-Protocol) organization. **This repository is an off chain oracle publisher**: it holds no funds and decides no payouts. It only reads weather data and submits signed observations that the on chain core verifies independently.

| Layer | Repository | What it does |
|---|---|---|
| On chain core | [`mvua-contract`](https://github.com/Mvua-Protocol/mvua-contract) | Risk pools, policies, oracle adapter, trigger engine, payout vault. |
| **Oracle publisher** | **`mvua-publisher`** (this repo) | **Fetch weather archives, corroborate, sign, and submit observations.** |

The contract is the source of truth. This publisher is one of potentially several independent voices feeding it; the `oracle-adapter` aggregates a median and verifies every signature, so a single misbehaving or offline publisher cannot move the index on its own.

## Why a separate repository

The publisher runs in a different place, on a different clock, with a different trust surface than the contracts:

- **Runtime**: this is a long running Node.js process with network egress and a signing key in memory. The contracts are deterministic on chain code with no I/O. Mixing them would drag an untrusted runtime into the audited core.
- **Trust boundary**: the contract must treat every observation as adversarial input and verify it. Keeping the publisher out of the contract repo keeps that boundary honest: the publisher earns no special trust from sharing a codebase.
- **Cadence**: the publisher iterates on data sources and scheduling far more often than the contract changes. Independent release cadences keep contract history clean.
- **Operators**: third parties can run their own publisher against the same contract without forking or building the contracts.

The one genuine coupling is the payload schema. See [The schema contract](#the-schema-contract).

## How a run works

A run reports a single UTC day and either submits one observation or aborts. It never submits a half made reading: a missing observation is safe, a wrong one is not.

```
  Open-Meteo (primary) ─┐
                        ├─► corroborate ─► scale mm→i128 ─► sign (ed25519) ─► submit
  NOAA GHCN-D (cross) ──┘      within         value              payload         oracle-adapter
                              maxDelta         *scale             XDR             .submit(...)
```

1. **Fetch** the day from two independent sources: [Open-Meteo](https://open-meteo.com) archive as primary (keyless, low latency) and [NOAA GHCN-Daily](https://www.ncei.noaa.gov) via the CDO v2 API as a cross check (token gated, higher latency).
2. **Corroborate**: if the two sources disagree by more than `MVUA_MAX_SOURCE_DELTA` (in scaled units), the run throws and submits nothing.
3. **Scale**: millimetres are multiplied by `MVUA_VALUE_SCALE` and rounded to an integer, so a fractional reading becomes an exact `i128` the contract can store.
4. **Sign**: the payload is encoded to XDR and signed with the publisher ed25519 key. This is the message the contract reconstructs and verifies.
5. **Submit**: a separate fee paying account sends the transaction to `oracle-adapter.submit`.

Every failure path aborts before submission. There is no retry or catch up in this version; an external scheduler invokes the run once per day.

## The two keys

The `submit` call authenticates by the ed25519 signature over the payload, not by `require_auth`. Two distinct keys are therefore in play, and they must not be the same identity:

- **Publisher signing key** (`MVUA_PUBLISHER_SEED_HEX`): a raw 32 byte ed25519 seed. Its public key is registered on chain by the guardian. This key attests that the observation is genuine. Generate one with `npm run keygen`.
- **Submitter account** (`MVUA_SUBMITTER_SECRET`): an ordinary Stellar `S...` secret. It only pays the transaction fee and supplies a sequence number. It has no authority over the observation.

Keeping them separate means the fee paying account can be rotated or funded freely without touching the attestation identity, and a leaked submitter secret cannot forge observations.

## The schema contract

The contract verifies each submission by checking an ed25519 signature over the XDR of its `#[contracttype]` struct:

```rust
pub struct ObservationPayload {
    pub region: Symbol,
    pub metric: Symbol,
    pub timestamp: u64,
    pub value: i128,
}
```

A `#[contracttype]` struct is stored on the host as an `ScMap` whose keys are the field name `Symbol`s, and `to_xdr` emits those entries **sorted by key**. So the serialized field order is alphabetical, `metric, region, timestamp, value`, not the declaration order. `src/schema/observation.ts` reconstructs that exact `ScVal` and serializes it, so the bytes signed here are byte for byte what the contract verifies.

This is the single most likely point of silent divergence, so it is isolated in one `FIELD_ORDER` constant and pinned by a golden fixture test (`test/observation.xdr.test.ts`) against a Rust `to_xdr` reference. See [`test/fixtures/README.md`](./test/fixtures/README.md) for how to generate the reference. If the encoder and the contract ever drift, that test fails instead of every submission silently trapping.

## Getting started

Requires Node.js 24 (pinned in `.nvmrc`).

```bash
npm ci                    # install pinned dependencies
cp .env.example .env      # then fill in the values
npm run keygen            # generate a publisher ed25519 identity
npm run build             # type check and compile to dist/
npm test                  # run the test suite
npm run dev 2026-09-28    # report one UTC day (defaults to yesterday)
```

Configuration is entirely through environment variables, validated at startup with zod; a missing or malformed value aborts the run before any work. See `.env.example` for the full contract, including the region, metric, coordinates, and NOAA station.

## Development

- Trunk based: short lived branches off `main`, no direct pushes to `main`.
- Conventional commits, subject line 72 characters or fewer.
- Before opening a PR: `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run build`, and `npm test` must all pass. CI enforces the same, plus a dependency audit, commit lint, and a secret scan.
- Determinism and fail closed behaviour are requirements, not preferences: the same inputs must produce the same bytes, and any doubt aborts the run.

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE).

