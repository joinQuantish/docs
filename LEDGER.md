# LEDGER — Polynode documentation

Append-only. Newest first. Record source, merge, validation, and deployment
evidence for production documentation changes.

- 2026-08-18 [codex] — Prepared the exact-order-identity correction for the
  Connect Wallet → user-owned V2 guide after a clean-room audit reproduced a
  false-positive timeout match between two same-wallet orders with identical
  descriptive fields. The guide now requires the canonical standard exchange
  order hash to be durably recorded before transport and exact-matched against
  open-order `id` and fill `order_hash`; amount, price, token, direction, and
  time are validation only and never candidate identity. TypeScript source
  `bd8b7d21fd088b6be11d25dbc2a66674a6210266` merged as
  `594f3369f08212ec267d9f5e580253c274b23e44`; public
  `polynode-sdk` 0.14.2 has SHA-256
  `747039c7cc4b2cd4672956eb625261731f82cff7b461a2c45cc4085023256626`.
  Python source `ccb105154351c7e03d0a332210ce3851e689fde5` merged as
  `19455ab035f4ab0c168d6b16387c6d72f0a0b77c`; public `polynode` 0.14.1
  wheel and sdist have SHA-256
  `e6a1bfe8c5cd6e9fbd16207372329a09f3002d81458215704705dfa85bc2a69f`
  and `cb3973c405e4ac40bfcc31b494a4ebf42056fb1ba4bdb8975e591ed28fcd0b03`.
  Rust source `1195e6d066857d7569476eacf122791343093109` merged as
  `d6c5ce4f01de5453609dd4cceb94c395e8540eaa`; public `polynode` 0.17.1
  has registry checksum
  `ec244f32da7f097b6be6c4f08f8daeda888c54245a01875807f859021d6fb805`.
  Changed-page JSON, frontmatter, fence, local-link, diff, brand, version,
  secret, private-path, and frontend-artifact checks pass. Deployment and a
  final fresh public-documentation-only audit will be recorded after rollout.

- 2026-08-18 [codex] — Prepared the clean-room audit follow-up for the public
  Connect Wallet → user-owned order documentation and published TypeScript
  `polynode-sdk` 0.14.1. The revised guide adds the minimal zero-advisory
  browser install, direct viem provider typing, wallet-confirmed USDC.e → pUSD
  funding, exact authorization response and Rust expiry/address/dependency
  contracts, authenticated-owner conditional atomic takes, exception-safe
  trader cleanup, and a conservative cross-SDK ambiguous-submit correlation
  procedure. General trading installs now separate optional builder-relayer
  peers and their upstream advisories from the user-owned dependency graph;
  account-selection language distinguishes the browser session from the
  legacy server-signer fallback. The public 0.14.1 tarball has SHA-256
  `7ef9af89d0733b44942116a8f45e788c45ec43930b3effbb7586e4d639f29120`;
  anonymous ESM/CommonJS, strict viem-provider typing, production audit, and
  Vite browser gates passed. Changed-page JSON, frontmatter, fence, component,
  local-link, brand, version, and diff checks pass. Deployment and final fresh
  public-doc-only agent-audit evidence will be recorded after live rollout.

- 2026-08-18 [codex] — Prepared the public Connect Wallet → user-owned V2
  order guide for TypeScript `polynode-sdk` 0.14.0, Python `polynode` 0.14.0,
  and Rust `polynode` 0.17.0. The guide separates browser-safe signing data
  from backend-only credentials and prepared state, documents browser-memory,
  encrypted backend-vault, and managed-signer custody models, and supplies the
  complete authorization, readiness, collateral, preview, signing, atomic
  submission, reconciliation, and support flow. It explicitly distinguishes
  developer-owned example routes from Polynode configuration, keeps platform
  keys and implementation details out of the browser, and documents one-time
  storage, HMAC-bound multi-worker state, account/chain invalidation, CSRF/CSP,
  log redaction, encrypted credential storage, ambiguous results, and ordinary
  rate and market limits. SDK version references, navigation, the concise
  user-owned overview, and the network-free testing-helper guidance were
  updated together. Local JSON, frontmatter, code-fence, navigation, link,
  brand, forbidden-term, and diff checks pass. Publication and live deployment
  evidence will be recorded after all three packages are available publicly.

- 2026-08-15 [codex] — Completed the cross-SDK user-owned execution
  documentation audit at source commit
  `8c878d8796b30451548a9cc6f84972d198e50924`, merged as
  `836dc4f0077eafd17ab6150e292b81dd1260b193`. TypeScript examples compiled
  against the reviewed `polynode-sdk` 0.13.6 artifact, Python examples
  compiled and imported against public `polynode` 0.13.0, and Rust examples
  passed `cargo check --locked` against public `polynode` 0.16.0. Changed-page
  example tests, `docs.json`, frontmatter, fence balance, navigation, local
  links, brand, and diff checks passed. Mintlify deployment check
  `94939346826` completed successfully. Anonymous live fetches verified the
  updated user-owned execution, TypeScript trading, Python trading,
  deposit-wallet, and position-management pages.
