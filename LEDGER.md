# LEDGER — Polynode documentation

Append-only. Newest first. Record source, merge, validation, and deployment
evidence for production documentation changes.

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
