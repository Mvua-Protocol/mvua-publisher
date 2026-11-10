/**
 * Configuration checks for the cross check source (DR-0039): GFS is the default
 * and needs no NOAA settings; choosing NOAA requires its station and token.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { ConfigError, loadConfig } from "../src/config.js";

const base = {
  MVUA_RPC_URL: "https://soroban-testnet.stellar.org",
  MVUA_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  MVUA_ORACLE_CONTRACT_ID: "C" + "A".repeat(55),
  MVUA_PUBLISHER_SEED_HEX: "a".repeat(64),
  MVUA_SUBMITTER_SECRET: "S" + "A".repeat(55),
  MVUA_REGION: "NG_KAN",
  MVUA_METRIC: "rain_mm",
  MVUA_LATITUDE: "12.048",
  MVUA_LONGITUDE: "8.525",
};

void test("gfs is the default cross check and needs no NOAA settings", () => {
  const c = loadConfig(base);
  assert.equal(c.crossSource, "gfs");
  assert.equal(c.noaaStationId, "");
});

void test("noaa as the cross check requires its station and token", () => {
  assert.throws(
    () => loadConfig({ ...base, MVUA_CROSS_SOURCE: "noaa" }),
    (e: unknown) =>
      e instanceof ConfigError &&
      e.message.includes("MVUA_NOAA_STATION_ID") &&
      e.message.includes("MVUA_NOAA_TOKEN"),
  );
  const c = loadConfig({
    ...base,
    MVUA_CROSS_SOURCE: "noaa",
    MVUA_NOAA_STATION_ID: "GHCND:KEM00063686",
    MVUA_NOAA_TOKEN: "t",
  });
  assert.equal(c.crossSource, "noaa");
  assert.equal(c.noaaStationId, "GHCND:KEM00063686");
});
