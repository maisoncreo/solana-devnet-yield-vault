# Local pure-JavaScript bigint adapter

This is new project-owned code, not a repackaged upstream binary or a claim of an upstream fix. npm installs it under the `bigint-buffer` dependency name via a direct local dependency and the `$bigint-buffer` override. It retains the dependency name `bigint-buffer` for npm deduplication. Version `1.1.6` is a private local version, NOT an upstream registry release; the `vaultImplementation: pure-js-local` field identifies it. Both applications include it in their lockfiles; no registry publication is required.

The four public functions used by `@solana/buffer-layout-utils` are supported: `toBigIntLE`, `toBigIntBE`, `toBufferLE`, `toBufferBE`. There is no native addon, build script, dynamic loading, or dependency other than Buffer's browser polyfill. The buffer-overflow implementation associated with GHSA-3gc7-fjrx-p6mg is not included.

Intentional contract differences: unsigned values only, overflow throws rather than truncating, Buffer input required, width/length limited to 4096 bytes (Solana layouts here use at most 32). Zero with width zero produces an empty buffer. Input buffers are never mutated. This is a compatibility adapter for the project's consumers, not a general replacement for all uses of upstream bigint-buffer.

Run `npm ci`, `npm --prefix frontend ci`, then `npm run test:codec` in the repository root. Tests check known endian vectors, independent hex references, randomized round-trips, invalid values, bounds, and actual resolution through SPL dependencies in both installations. Integration tests also exercise SPL account/instruction encoding and decoding against a validator.

A zero audit result for this local package is not an independent security audit. Future maintainers must review this code and run these tests when updating SPL dependencies. An audited upstream solution is preferred when available.
