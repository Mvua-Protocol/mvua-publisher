# Security Policy

The Mvua publisher is the off chain data author for a financial protocol: it holds ed25519 signing keys and its output drives on chain index evaluation. Security issues are a top priority.

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Use GitHub's private vulnerability reporting on this repository (Security tab: Report a vulnerability), or contact the maintainers directly through a private channel if you prefer.

Include:

1. Affected module or version (commit hash or release tag).
2. The deployment context (testnet, which oracle contract id) if relevant.
3. Steps or a proof of concept reproducing the issue.
4. Your assessment of impact and severity.

## What matters most here

The publisher's trust surface is narrow but sharp:

- **Signing key custody.** A leaked publisher private key lets an attacker forge observations under a registered identity. Keys must never enter the repository, logs, error messages, or telemetry. Report any path that could expose key material.
- **Data integrity.** Anything that lets a wrong value be signed and submitted (a source parsing bug, a unit or scale error, a normalization flaw) can move the on chain index. Treat these as high severity.
- **Supply chain.** An unpinned or malicious dependency in a process that holds signing keys is a direct compromise path. All dependencies are pinned and the lockfile is committed; report suspicious packages.

## Our commitment

| Severity | Acknowledgment | Fix target |
|---|---|---|
| Critical (key exposure, forgeable submissions) | 48 hours | As fast as safely possible; rotate affected keys |
| High (wrong value can be signed) | 72 hours | 30 days |
| Medium | 1 week | 60 days |
| Low | 2 weeks | Best effort, next release |

We will credit reporters in the release notes unless you prefer to stay anonymous.

## Scope

In scope: this repository's fetching, normalization, signing, and submission code, its configuration and secret handling, and its dependency set.

Out of scope: the contracts repository (report there), the upstream weather data providers' own availability, and theoretical issues without a realistic path to impact.

## Current status

Pre alpha, testnet only. Treat all deployments as unaudited. Publisher keys used on testnet must never be reused on mainnet.

## Safe harbor

We consider good faith security research conducted in line with this policy to be authorized, and we will not pursue action against researchers who respect testnet boundaries and report privately.
