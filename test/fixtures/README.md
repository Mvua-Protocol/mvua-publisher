# XDR golden fixture

`observation.xdr.hex` is intentionally absent from the initial scaffold. It is
the byte-for-byte hex of the `oracle-adapter` contract's
`ObservationPayload { region: "kilifi", metric: "rain_mm", timestamp:
1_700_000_000, value: 1234 }.to_xdr(&env)`.

Until this file exists, the equality assertion in
`test/observation.xdr.test.ts` is skipped and the structural checks still run.
This keeps the scaffold green while making the cross-check a tracked step, not
a silent gap.

## Generate it

Run a throwaway `#[test]` in the `oracle-adapter` crate:

```rust
use soroban_sdk::{xdr::ToXdr, Env, Symbol};

#[test]
fn print_observation_reference_hex() {
    let env = Env::default();
    let payload = ObservationPayload {
        region: Symbol::new(&env, "kilifi"),
        metric: Symbol::new(&env, "rain_mm"),
        timestamp: 1_700_000_000u64,
        value: 1234i128,
    };
    let bytes = payload.to_xdr(&env);
    let mut out = std::string::String::new();
    for b in bytes.iter() {
        out.push_str(&std::format!("{:02x}", b));
    }
    std::println!("{out}");
    // cargo test -p oracle-adapter print_observation_reference_hex -- --nocapture
}
```

Paste the single hex line printed by that test into `observation.xdr.hex`
(no `0x`, no whitespace, lowercase), commit it, and re-run `npm test`. If the
equality check then fails, the encoder in `src/schema/observation.ts` is wrong;
the most likely fix is the `FIELD_ORDER` constant.
