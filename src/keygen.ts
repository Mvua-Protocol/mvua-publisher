/**
 * Generate a publisher ed25519 identity.
 *
 * Prints a 32-byte seed (keep secret, this is MVUA_PUBLISHER_SEED_HEX) and the
 * corresponding 32-byte public key (give this to the guardian to register with
 * `oracle-adapter.propose_publisher`). Nothing is written to disk; copy the
 * values into your secret store.
 *
 * Usage: `npm run keygen`
 */
import { randomBytes } from "node:crypto";
import nacl from "tweetnacl";

function main(): void {
  const seed = randomBytes(32);
  const pair = nacl.sign.keyPair.fromSeed(new Uint8Array(seed));
  const publicKey = Buffer.from(pair.publicKey);

  console.log("Publisher ed25519 identity (testnet):");
  console.log(`  seed (secret, MVUA_PUBLISHER_SEED_HEX): ${seed.toString("hex")}`);
  console.log(`  public key (register on chain):         ${publicKey.toString("hex")}`);
  console.log("");
  console.log("Store the seed in your secret manager. Never commit it. The public key");
  console.log("is what the guardian registers in the oracle-adapter publisher registry.");
}

main();
