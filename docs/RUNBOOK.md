# Publisher runbook

How to run an Mvua publisher from start to finish: from generating keys to running it daily, monitoring it, and handling failures. It is written for an operator who has never seen the code. For what a run does internally, see the [README](../README.md).

A publisher reports one number a day: yesterday's rainfall in one region, signed with its own key. The oracle takes the median of the active publishers' latest readings and ignores any reading older than the staleness bound (48 hours by default). It needs at least two fresh publishers before the index can use a day, so a single publisher that stops reporting can hold up its region.

## 1. What you need

- **Node 24** (see `.nvmrc`) and git.
- **A machine that runs once a day:** a small server, a cron host, or GitHub Actions. One run takes under a minute (a few minutes if a source is slow).
- **A funded Stellar account** to pay transaction fees (the submitter). On testnet, fund it with Friendbot. Each submission costs about 0.23 to 0.37 XLM; budget about 110 XLM a year per region.
- **A licensed weather data source.** The default primary, the Open-Meteo archive, is free for non-commercial use only. A commercial operator needs a paid plan or another licensed source.
- **The guardian's cooperation** to register your key (step 3).

## 2. Install and create your keys

```bash
git clone https://github.com/Mvua-Protocol/mvua-publisher.git
cd mvua-publisher
npm ci
npm run build
npm run keygen
```

`keygen` prints two values:

- **seed (secret):** your publisher signing key. Store it in a secret manager and never commit it, paste it in chat, or log it. Anyone holding it can sign readings as you.
- **public key:** what the guardian registers on chain. Safe to share.

The submitter account is a separate identity: an ordinary Stellar `S...` secret that only pays fees. Never reuse the publisher seed as the submitter, or the other way round (see [The two keys](../README.md#the-two-keys)).

## 3. Get registered

Send your **public key** to the guardian, with the region and metric you will report. The guardian calls `oracle-adapter.propose_publisher(<public key>, true)`. That starts a **7 day timelock**. After it, the guardian calls `execute_publisher(<public key>)` and you are active. Readings submitted before then are rejected.

You can check from any Stellar CLI:

```bash
stellar contract invoke --id <ORACLE_ID> --network testnet --send=no -- is_publisher --publisher <PUBLIC_KEY_HEX>
```

## 4. Configure

```bash
cp .env.example .env
```

Fill in every value; `.env.example` explains each one. The ones that must be exactly right:

| Variable                          | What to set                                                                                                                                  |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `MVUA_ORACLE_CONTRACT_ID`         | The live `oracle-adapter` id (from the [testnet deployment page](https://mvua-site.vercel.app/docs/reference/deployment)).                   |
| `MVUA_PUBLISHER_SEED_HEX`         | Your seed from step 2.                                                                                                                       |
| `MVUA_SUBMITTER_SECRET`           | The fee paying account's secret.                                                                                                             |
| `MVUA_REGION`, `MVUA_METRIC`      | Exactly the region and metric of the index definition you feed, for example `KE_NAK` and `rain_mm`. A typo means your readings feed nothing. |
| `MVUA_LATITUDE`, `MVUA_LONGITUDE` | The region's reference point, the same one the index was calibrated on.                                                                      |
| `MVUA_VALUE_SCALE`                | `100` (hundredths of a millimetre). It must match the index definition; never change it on your own.                                         |

The service validates the whole file at startup and refuses to run if anything is missing or malformed.

## 5. First run

Report one past day by hand and check that it lands:

```bash
npm run dev 2026-11-20
```

A good run ends with a `submitted` log line and a transaction hash; look it up on [Stellar Expert](https://stellar.expert/explorer/testnet). `already submitted` is also fine: the oracle already has that day from you. Any other ending means nothing was submitted (see section 8).

## 6. Run it daily

Schedule one run a day, a few hours after midnight UTC, so yesterday is complete in both data sources. Pick one:

- **cron** (Linux):

  ```bash
  0 6 * * * cd /opt/mvua-publisher && /usr/bin/node --env-file=.env dist/src/index.js >> publisher.log 2>&1
  ```

- **Task Scheduler** (Windows): see [Running it daily](../README.md#running-it-daily).
- **GitHub Actions:** fork the repository and use `.github/workflows/publish.yml`. Put the seed and submitter secret in repository secrets and the rest in repository variables, as described in [Running it on GitHub Actions](../README.md#running-it-on-github-actions). Secrets are set by you in the repository settings; nobody else needs to see them.

Keep the `cache/` folder between runs. It lets a failed day be replayed with the same value, and lets the next run fill a missed day.

## 7. Monitor

- **Exit code:** a run that did not submit exits non zero. Alert on it.
- **Uptime:** `npm run status` (from publisher v0.2.0) prints, from the cache, the days submitted and missed over the last 30 days and whether uptime meets the 99.5% target. On GitHub Actions it is written to every run's summary.
- **Fee account balance:** top up the submitter well before it runs dry.

## 8. When a run fails

Read the last log line; it says why. The common causes:

| Log says                                                            | Meaning                                                                                                         | What to do                                                                                                                 |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `fetch failed` or an HTTP 5xx, after retries                        | A data source was unreachable for several minutes.                                                              | Nothing. The next run fills the missed day, up to 7 days back. If it keeps failing, check the source's status page.        |
| sources disagree                                                    | The primary and the cross check differ by more than `MVUA_MAX_SOURCE_DELTA`. Nothing was submitted, on purpose. | Do not raise the limit to force it through. Note the day and tell the guardian; a missing day is safe, a wrong one is not. |
| `already submitted` (the oracle's `ReplayedObservation`, error 309) | The oracle already has a reading from you for that day or a later one.                                          | Nothing; the run treats it as done.                                                                                        |
| `BadSignature` or error 301                                         | The signature does not match the registered key.                                                                | Check `MVUA_PUBLISHER_SEED_HEX` is the seed whose public key was registered.                                               |
| config errors at startup                                            | `.env` is missing or malformed.                                                                                 | Fix the named variable.                                                                                                    |
| a transaction failure mentioning balance or fee                     | The submitter account is probably out of XLM.                                                                   | Top it up; the next run replays the cached day.                                                                            |
| `UnknownPublisher` or error 300                                     | Your key is not active on this oracle.                                                                          | Check `is_publisher`; confirm the oracle id and that the guardian executed your registration.                              |

Never delete the cache to "fix" a run unless you mean to start over, and never submit a day by hand with a value you typed in.

## 9. Rotate or retire a key

- **Rotate:** generate a new key (`npm run keygen`), ask the guardian to propose it (7 day timelock), switch your `.env` to the new seed once it is active, then ask the guardian to retire the old key with `propose_publisher(<old key>, false)` followed by `execute_publisher`.
- **Suspected leak:** tell the guardian at once. A leaked seed can sign false readings until it is retired; the guardian can also challenge a bad reading during the challenge window.
- **Stop publishing:** tell the guardian so the key is retired, rather than going silent. A silent publisher keeps its place in the registry, and with only two or three publishers its absence can leave the region without the two fresh readings the median needs.

## 10. Security checklist

- The seed lives only in a secret manager or the machine's `.env` (permissions limited to the service user), never in git, logs, chat or screenshots.
- The submitter account holds only enough XLM for fees.
- The machine is patched, and only the operator can reach it.
- Report a suspected vulnerability privately, as described in [SECURITY.md](../SECURITY.md).
