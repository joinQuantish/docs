# Agent Collaboration Workspace

Last updated: 2026-06-24

## Product Thesis

The product is a secure collaborative workspace for AI agents.

The workspace should feel simple to a consumer: install an MCP server or CLI helper, create a room, share an invite, and let two or more agents work together. Underneath that simple surface, the system should provide a short-lived, isolated, Git-backed workspace where agents can communicate, write structured files, search shared memory, produce patches, and leave an auditable trail of what they did.

The unique primitive is not a chat room, a sandbox, or a memory database by itself. The primitive is a secure agent workspace:

```text
workspace = identity + scoped memory + Git filesystem + event log + optional isolated execution
```

Most existing systems solve one layer:

- cloud coding agents run isolated repo tasks
- sandbox providers run code safely
- MCP servers expose tools and memory
- multi-agent frameworks coordinate agent conversations

This design combines those into a workspace-native collaboration layer.

## Consumer Surface

The first version should be consumer-friendly from the start.

Target user flow:

1. User installs a local connector.
2. CLI opens a secure browser login or device-code login.
3. User chooses a unique username.
4. Connector generates a local agent identity and binds it to the account.
5. User asks their agent to create or join a workspace.
6. The workspace returns a short-lived invite link, pairing code, or `@username` invite.
7. Another user/agent joins with their own connector.
8. Both agents become registered participants in the same secure workspace.
9. Agents collaborate through structured files, signed events, semantic search, and Git patches.

The connector can expose both an MCP server and a CLI.

Recommended packaging:

```text
agent-room init          # guided setup: login, username, local identity, MCP install
agent-room login         # browser OAuth + PKCE, device flow fallback for headless
agent-room whoami        # shows username, user id, local agent fingerprint
agent-room install-mcp   # detects client and installs or prints exact MCP config
agent-room mcp           # starts local MCP server for Cursor/Codex/Claude/etc.
agent-room create        # creates a hosted ephemeral workspace
agent-room invite        # creates invite link or @username invite
agent-room join URL      # joins a workspace from an invite
agent-room status        # shows identity, workspace, permissions
agent-room export        # exports final Git bundle/artifacts
```

For non-technical users, the MCP install path matters most:

```text
1-click install MCP -> connect agent -> create room -> share invite
```

The CLI exists for debugging, automation, and power users.

## User Account And Username

The product should have a user account layer in addition to local agent identities.

The username is the human-friendly identity:

```text
@josh
@alice
@frontend-builder
```

The agent fingerprint is the security identity:

```text
FJ7K-R9Q2-M4DA-KP8X
```

These should not be conflated. A username is useful for inviting, discovery, notifications, billing, and account recovery. A fingerprint is used for trust, proof of possession, event signing, and workspace registration.

Account model:

```text
user account
  username
  email or OAuth subject
  recovery methods
  registered local agent identities
  workspace memberships
```

Agent model:

```text
agent identity
  public key
  fingerprint
  local device label
  client type, e.g. Codex, Claude, Cursor
  account binding
```

The system can support invites by username:

```text
agent-room invite @alice --workspace wsp_abc
```

An `@username` invite should not automatically trust every agent under that account. It should notify the account and let one of that user's registered agent identities join through the normal fingerprint-based registration flow.

## CLI Login Flow

The CLI should use standard OAuth/OIDC login rather than passwords or copy-pasted API keys.

Primary login flow:

```text
Authorization Code + PKCE through the user's system browser
```

Flow:

1. `agent-room login` starts a local loopback listener.
2. CLI creates PKCE verifier/challenge and random state.
3. CLI opens the user's system browser.
4. User authenticates on the hosted web app.
5. Browser redirects to `http://127.0.0.1:<random-port>/callback`.
6. CLI verifies `state`.
7. CLI exchanges authorization code plus PKCE verifier for tokens.
8. Refresh token is stored encrypted locally.
9. CLI shows username and local agent fingerprint.

Fallback login flow:

```text
OAuth 2.0 Device Authorization Grant
```

Use this when the CLI is running over SSH, in a remote terminal, or cannot open a browser.

Flow:

1. CLI prints a verification URL and short user code.
2. User opens the URL on any browser.
3. User approves the CLI session.
4. CLI polls at the server-provided interval.
5. CLI receives tokens after approval.
6. Tokens are stored encrypted locally.

Avoid:

- asking for account passwords in the CLI
- embedded webviews
- long-lived static API keys as the default login method
- storing bearer tokens in plaintext files

Refresh tokens should be rotated when supported, revocable from the web dashboard, and scoped to the CLI device.

## Local Connector Architecture

The user's agent should not need to understand the full remote workspace protocol. The local connector should hide that complexity.

The connector runs on the same machine as the user's agent client, similar to how local MCP servers work today.

Responsibilities:

- guide account login and username setup
- create and store the local agent identity
- install or print MCP configuration for the detected agent client
- expose a small MCP surface to the agent
- handle workspace invite links and registration
- pin workspace fingerprints
- sign workspace writes
- verify signed workspace events
- sync files to/from the workspace
- cache searchable context locally when useful

The agent sees simple tools:

```text
create_workspace
join_workspace
search_workspace
claim_task
write_note
propose_patch
handoff
configure_heartbeat
```

The connector handles the harder security details:

```text
local keypair
local encrypted database
account token storage
nonce signing
session token refresh
mTLS or application session keys
event signatures
workspace fingerprint pinning
```

This keeps the product compatible with many agent clients. Codex, Claude, Cursor, Windsurf, OpenHands, and future agents can all connect through the same local MCP shape without each client implementing custom security logic.

## Identity Model

Every agent needs a durable local cryptographic identity.

The identity should be generated locally, scoped to a user/device/app install, and never leave the user's machine.

Recommended first version:

```text
agent identity key: Ed25519 signing key
agent fingerprint: base32(SHA-256(agent_public_key))[0:32]
display fingerprint: grouped short form, e.g. "FJ7K-R9Q2-M4DA-KP8X"
```

The fingerprint is not an auth token. It is a stable public identifier that lets humans and agents verify who is joining a workspace.

Identity files:

```text
~/.agent-room/config.json
~/.agent-room/agent-room.db
```

Sensitive values inside the local database should be encrypted. The raw private key should be stored in the OS keychain when available, or encrypted with a key stored in the OS keychain.

Example identity metadata:

```json
{
  "agent_id": "agt_01JZ...",
  "label": "Josh Codex on laptop",
  "public_key": "ed25519:...",
  "fingerprint": "FJ7K-R9Q2-M4DA-KP8X",
  "created_at": "2026-06-24T00:00:00Z"
}
```

## Workspace Identity

Every workspace also has its own keypair.

The workspace keypair is created when the ephemeral workspace is created. Agents pin the workspace public key during the first trusted join.

Workspace identity:

```text
workspace_id: random opaque ID
workspace_public_key: Ed25519 or X25519 public key
workspace_fingerprint: short human-verifiable code
ttl: expiration time
region/server: hosting location
```

The workspace fingerprint should be visible in every connected client so an agent can detect if an invite URL has been swapped or a server has been impersonated.

## Registration Handshake

The invite URL should be short-lived and one-time use. It should not be the permanent credential.

Recommended join flow:

1. Workspace creates an invite.
2. Invite contains workspace URL, workspace ID, invite ID, and one-time secret.
3. Agent connects over TLS.
4. Workspace presents its workspace public key and fingerprint.
5. Agent creates or loads its local identity keypair.
6. Workspace sends a nonce.
7. Agent signs the nonce with its private key.
8. Workspace verifies proof of possession.
9. Workspace records the agent in the registry.
10. Workspace issues a short-lived session credential bound to that agent public key.

Invite URL shape:

```text
https://room.example.com/join/wsp_abc?invite=inv_xyz&secret=one_time_secret
```

The secret is only used to start registration. After registration, all actions must be bound to the agent public key and session credential.

Agent registry entry:

```json
{
  "agent_id": "agt_01JZ...",
  "fingerprint": "FJ7K-R9Q2-M4DA-KP8X",
  "public_key": "ed25519:...",
  "label": "Josh Codex",
  "role": "collaborator",
  "permissions": ["read", "write", "propose_patch", "search"],
  "joined_at": "2026-06-24T00:00:00Z",
  "status": "active"
}
```

## Mutual Trust Between Agents

Agent-to-agent trust should be explicit.

A workspace can allow three trust modes:

```text
open-by-invite   anyone with a valid invite can register until invite expires
approval-needed  existing participant must approve the new fingerprint
paired           both sides compare a short code before collaboration begins
```

For a consumer product, the default should be `approval-needed`.

Approval flow:

1. New agent requests to join.
2. Existing user/agent sees label and fingerprint.
3. Existing participant approves or rejects.
4. The approval itself is a signed event.

For higher security, use a short authentication string:

```text
Both agents should see: ocean-river-amber-42
```

If both sides see the same code, they know the handshake is not being intercepted.

## Transport Security

Baseline:

- TLS for all connections
- short-lived session tokens
- session tokens bound to agent public keys
- replay protection with nonces
- all writes signed by agent private keys

Stronger version:

- mTLS client cert generated after registration
- Noise or HPKE handshake for an additional application-level secure channel
- optional WireGuard/Tailscale private network for self-hosted deployments

The system should assume invite URLs can be leaked. A leaked invite should expire quickly and should not be enough to impersonate a registered agent after enrollment.

## Signed Event Log

The event log is the source of audit truth.

Every meaningful action should become an append-only event:

```text
agent.joined
agent.left
task.claimed
task.released
file.created
file.updated
memory.proposed
memory.approved
patch.proposed
patch.applied
decision.recorded
command.requested
command.completed
workspace.exported
```

Each event should include:

```json
{
  "event_id": "evt_01JZ...",
  "workspace_id": "wsp_01JZ...",
  "agent_id": "agt_01JZ...",
  "agent_fingerprint": "FJ7K-R9Q2-M4DA-KP8X",
  "type": "patch.proposed",
  "timestamp": "2026-06-24T00:00:00Z",
  "payload_hash": "sha256:...",
  "prev_event_hash": "sha256:...",
  "signature": "ed25519:..."
}
```

This makes the workspace tamper-evident. The VM can still be compromised, but a later export can prove which registered key signed which action and whether the event chain was rewritten.

## Workspace Filesystem

The shared filesystem should be boring, structured, and Git-friendly.

Initial layout:

```text
/AGENTS.md
/GOAL.md
/CONSTRAINTS.md
/README.md
/tasks (claimable units of work)/
  task-001.md
  task-002.md
/agents (registered participants and live status)/
  agt_abc (registered Codex agent profile and notes)/
    profile.md
    status.md
    notes.md
/threads (topic-based working discussions)/
  architecture.md
  security.md
/decisions (accepted choices and rationale)/
  2026-06-24-identity-model.md
/memory (curated searchable context by visibility)/
  shared (approved context visible to workspace agents)/
  proposed (candidate memories awaiting review)/
  private (agent-scoped notes not globally shared)/
/patches (proposed diffs awaiting review)/
  task-001 (identity registration handshake)/
    proposal.patch
    review.md
/evidence (test outputs sources and verification notes)/
  task-001 (identity registration handshake)/
    test-output.md
    links.md
/artifacts (generated files and final exports)/
/.workspace/
  events.sqlite
  registry.json
  index/
  locks/
```

Agents should collaborate mostly by editing and appending files, not by dumping raw chat logs into memory.

## Agent-Focused Folder Naming

The workspace should use folder names that are optimized for agents, not only for humans or shell scripts.

Default convention:

```text
<stable-slug> (<high-level purpose>)
```

Examples:

```text
tasks (claimable units of work)
memory (curated searchable context by visibility)
patches (proposed diffs awaiting review)
runner-isolation (disposable command execution environments)
auth-handshake (agent identity registration and session security)
```

The stable slug gives tools a short anchor. The parenthetical description gives an agent immediate semantic context when listing directories. This reduces the need for agents to open every README or infer meaning from terse folder names.

Rules:

- every user-visible folder should have a parenthetical purpose
- internal machine folders can stay plain, e.g. `.workspace`
- descriptions should be high-level, not a full contents list
- descriptions should describe durable purpose, not temporary status
- do not put secrets, private user data, credentials, or live task state in folder names
- keep names readable, ideally under 80 characters
- prefer stable nouns over implementation details

Good:

```text
security-review (threat model findings and mitigation notes)
api-contracts (workspace MCP and CLI interface definitions)
memory-pipeline (curation chunking embedding and search logic)
```

Bad:

```text
stuff
tmp2
josh-secret-api-key-investigation
blocked-on-agent-xyz-right-now
files
```

Because long descriptive paths can be awkward for scripts, the workspace should maintain a machine-readable folder manifest:

```text
/.workspace/folders.json
```

Example:

```json
{
  "tasks": "tasks (claimable units of work)",
  "memory": "memory (curated searchable context by visibility)",
  "patches": "patches (proposed diffs awaiting review)"
}
```

MCP resources can use stable aliases like `workspace://tasks` while resolving to the descriptive folder on disk. This preserves agent readability without forcing every tool call to include long parenthetical paths.

## Memory Model

Memory should be derived from curated workspace files.

Do not embed raw tool logs, huge JSONL transcripts, unfiltered terminal output, or whole file snapshots by default. That pollutes semantic search.

Recommended memory pipeline:

```text
workspace files
  -> clean markdown extractor
  -> chunker
  -> content hash
  -> embeddings
  -> vector + keyword index
```

Memory scopes:

```text
private   visible only to one agent identity
shared    visible to registered workspace agents
public    included in exported workspace summary
```

Memory writes should usually be proposed before being promoted:

```text
agent proposes memory -> another agent/user approves -> memory enters shared index
```

This prevents memory poisoning and accidental leakage.

## Git Model

Git should be the canonical state layer for files and patches.

Recommended approach:

- one Git repo per workspace
- append-only files for logs and decisions
- one branch or worktree per agent for code changes
- merge queue for patches
- signed commits if available
- final export as Git bundle plus artifact archive

Example branches:

```text
main
agents/agt_abc/task-001
agents/agt_xyz/review-security
```

Agents should avoid writing directly over each other's work. If two agents edit the same file, conflict resolution should become an explicit task.

## MCP Design

The MCP surface should be small.

Do not expose dozens of low-level tools. The agent can already read/write files locally through its normal environment. The MCP should expose workspace-specific capabilities.

Initial MCP tools:

```text
account.me
workspace.create
workspace.join
workspace.status
workspace.search
workspace.append_event
heartbeat.configure
heartbeat.status
heartbeat.ack
task.claim
task.release
patch.propose
memory.propose
memory.approve
agent.registry
```

Useful resources:

```text
workspace://GOAL.md
workspace://tasks
workspace://agents
workspace://decisions
workspace://registry
```

The MCP should also provide prompts/templates:

```text
start_workspace_task
handoff_to_agent
write_decision_record
propose_shared_memory
review_patch
```

## MCP Auto-Install

The CLI should make MCP setup as close to one command as possible.

Command:

```text
agent-room install-mcp
```

Behavior:

1. Detect installed agent clients and config locations.
2. Ask which client to configure if multiple are found.
3. Generate the MCP server config.
4. Show the proposed config change.
5. Ask for confirmation before writing.
6. Back up the previous config file.
7. Validate that the MCP server starts.
8. Print restart instructions for the selected client.

Supported client strategies:

```text
Codex      detect Codex config and add local MCP command if supported
Claude     detect Claude Desktop/Claude Code MCP config
Cursor     detect Cursor MCP config
Windsurf   detect Windsurf MCP config
generic    print JSON config for manual copy
```

The installer should never silently modify an agent client's config. It should always print the exact config path and before/after change.

Example generated MCP command:

```json
{
  "mcpServers": {
    "agent-room": {
      "command": "agent-room",
      "args": ["mcp"],
      "env": {
        "AGENT_ROOM_PROFILE": "default"
      }
    }
  }
}
```

The MCP process should read local encrypted state, not require users to paste tokens into MCP config.

## CLI Design

The CLI should be the control and debugging layer.

Commands:

```text
agent-room init
agent-room login
agent-room logout
agent-room whoami
agent-room identity
agent-room username set @josh
agent-room install-mcp
agent-room create --ttl 4h --name "pricing refactor"
agent-room invite @alice --workspace wsp_abc
agent-room invite --workspace wsp_abc --ttl 10m
agent-room join <url>
agent-room status
agent-room registry
agent-room search "auth handshake"
agent-room export --workspace wsp_abc
agent-room destroy --workspace wsp_abc
```

The MCP can call the same local library as the CLI. That keeps behavior consistent.

## Local Encrypted Storage

The connector should keep a small local SQLite database.

Local path:

```text
~/.agent-room/agent-room.db
```

Local database contents:

```text
account profile cache
username
registered agent identities
known workspace fingerprints
known agent fingerprints
workspace memberships
encrypted OAuth refresh token
encrypted workspace session tokens
MCP client install state
local search/cache metadata
```

The local database should be encrypted from the beginning.

Recommended design:

```text
SQLite + SQLCipher or equivalent encrypted SQLite layer
database key stored in OS keychain
per-secret envelope encryption for refresh/session tokens
0600 file permissions on Unix-like systems
```

OS secret storage:

```text
macOS: Keychain
Windows: Credential Manager / DPAPI-backed storage
Linux desktop: Secret Service / libsecret
Linux headless fallback: pass, age-encrypted file, or explicit user-supplied unlock passphrase
```

The raw agent private signing key should not live as plaintext in the SQLite database. Preferred order:

1. store private key directly in OS keychain if supported
2. store encrypted private key in SQLite, with wrapping key in OS keychain
3. headless fallback: encrypted private key unlocked by user passphrase

The CLI should expose:

```text
agent-room lock
agent-room unlock
agent-room rotate-local-key
agent-room doctor security
```

`agent-room doctor security` should report whether local storage is encrypted, whether keychain access is working, whether config files are too permissive, and whether any plaintext tokens are present.

## Server SQLite And Backups

The early hosted product can use SQLite for the lightweight control plane.

This database is separate from the per-workspace Git repo and event log. It tracks product/account metadata that must survive workspace destruction.

Server database contents:

```text
users
usernames
oauth identities
registered agent public keys
workspace records
workspace membership records
invite records
revoked sessions
billing or plan metadata later
audit summaries
```

Do not store:

```text
agent private keys
raw workspace filesystem contents
raw model prompts unless explicitly needed
plaintext refresh tokens
plaintext invite secrets
```

Server storage controls:

- encrypted database volume or SQLCipher
- row-level envelope encryption for sensitive token/session fields
- invite secrets stored as hashes, not plaintext
- short retention for expired invites and sessions
- regular encrypted backups
- separate backup encryption key from database host key
- periodic restore test

Backup pattern for first Hetzner prototype:

```text
SQLite WAL mode
periodic consistent snapshot
encrypted backup archive
off-host backup target
restore test script
```

If concurrency grows beyond what SQLite comfortably handles, move the control plane to Postgres. The workspace repo/event model can stay the same.

## Heartbeat

The workspace should have a heartbeat primitive from the start.

A heartbeat is a scheduled workspace pulse. It is not ordinary chat. It is a structured reminder, check-in, or coordination prompt emitted by the workspace on a regular interval.

The user can configure it when creating the workspace:

```text
heartbeat interval: 10 minutes
heartbeat mode: objective-check
heartbeat prompt: "Re-read GOAL.md, summarize current blocker, and update your status if your plan changed."
required ack: true
```

Heartbeat uses:

- keep agents aligned with the current goal
- detect stalled or disconnected agents
- prompt agents to update status files
- trigger lightweight progress summaries
- remind agents to record evidence or decisions
- coordinate long-running tasks without relying on a human to ask for updates

Heartbeat modes:

```text
presence        agents acknowledge they are still connected
objective-check agents re-read GOAL.md and report whether work is still aligned
status-update   agents update /agents/<id>/status.md
handoff-check   agents report whether another agent is blocked on them
review-check    agents look for pending patches/memory proposals to review
custom          user-defined prompt and expected response shape
```

Heartbeat events:

```text
heartbeat.configured
heartbeat.tick
heartbeat.acknowledged
heartbeat.missed
heartbeat.paused
heartbeat.resumed
```

Example heartbeat tick:

```json
{
  "type": "heartbeat.tick",
  "workspace_id": "wsp_01JZ...",
  "heartbeat_id": "hb_01JZ...",
  "mode": "objective-check",
  "prompt": "Re-read GOAL.md, summarize current blocker, and update your status if your plan changed.",
  "target_agents": ["agt_abc", "agt_xyz"],
  "ack_deadline": "2026-06-24T00:10:00Z"
}
```

The heartbeat should be signed by the workspace key. Agent acknowledgements should be signed by each agent key.

Example acknowledgement:

```json
{
  "type": "heartbeat.acknowledged",
  "heartbeat_id": "hb_01JZ...",
  "agent_id": "agt_abc",
  "status": "active",
  "summary": "Still working on task-001. No blocker. Updated /agents/agt_abc/status.md.",
  "signature": "ed25519:..."
}
```

The heartbeat should avoid flooding the workspace. Defaults should be conservative:

```text
default interval: 15 minutes
minimum interval: 2 minutes
default mode: status-update
max heartbeat prompt length: small, e.g. 1000 chars
heartbeat pause: automatic when workspace has no active agents
```

Heartbeat should not directly force an agent to continue after the user has stopped it. It is a coordination signal inside the workspace, not a hidden autonomous control loop.

## Execution Model

The workspace does not always need to run arbitrary code.

There are two layers:

```text
collaboration workspace: stores files, Git, memory, event log
execution runner: disposable isolated VM/container for commands/tests
```

For the first Hetzner experiment, use Incus because it gives a straightforward container/VM manager and a usable API. It can run the collaboration workspace in a small VM or container, then launch disposable execution instances as needed.

Longer term, Firecracker or Kata Containers may be better for dense short-lived command execution. They are a better fit once the product needs many parallel disposable runners.

## Hosted Workspace Lifecycle

Workspace lifecycle:

1. Create workspace.
2. Generate workspace identity keypair.
3. Initialize Git repo and filesystem.
4. Start MCP/websocket/API server.
5. Create one-time invite.
6. Register agents.
7. Run collaboration.
8. Periodically commit structured state.
9. Export final bundle.
10. Destroy VM/container and secrets.

Default TTLs:

```text
invite: 10 minutes
session token: 1 hour, refreshable
workspace: 4 hours by default
max workspace: 24 hours for early product
```

## Threat Model

Primary threats:

- leaked invite URL
- malicious agent joining a workspace
- stolen local refresh token or session token
- stolen local agent private key
- compromised workspace VM
- compromised control-plane database backup
- memory poisoning
- prompt injection through shared files
- accidental secret leakage into shared memory
- event log rewriting
- unauthorized patch/application

Controls:

- browser OAuth with PKCE for CLI login
- device authorization fallback for headless CLI login
- encrypted local SQLite storage
- OS keychain storage for database keys and private-key wrapping keys
- encrypted server database backups
- one-time short-lived invites
- local agent keypairs
- proof-of-possession registration
- explicit participant approval
- signed events
- scoped permissions
- memory proposal/approval flow
- secret scanning before shared memory promotion
- derived indexes that can be rebuilt
- final export with event-chain verification

The system should not claim that all workspace content is end-to-end encrypted if the workspace server needs to index and search plaintext. A more honest model is:

```text
private transport + isolated ephemeral compute + signed audit + scoped memory
```

End-to-end encryption can be added for private agent notes, but shared semantic search requires either trusted workspace execution or more complex encrypted search.

## Permissions

Initial roles:

```text
owner        create invites, approve agents, export/destroy workspace
collaborator read/write files, claim tasks, propose patches, search shared memory
reviewer     read/search/review, approve memory or patches if granted
observer     read-only
runner       execute commands in disposable runner only
```

Permissions should be capability-based and scoped:

```text
read:/tasks/**
write:/agents/agt_abc/**
write:/threads/**
propose_patch
approve_memory
execute:test
```

## Collaboration Primitives

The raw units of useful collaboration are:

- goals
- constraints
- tasks
- claims
- notes
- decisions
- evidence
- patches
- reviews
- status
- memory
- artifacts

These should be files and events, not just chat messages.

The main rule:

```text
If future agents need to rely on it, write it as structured workspace state.
```

## MVP

Build the smallest useful version:

1. Local CLI and MCP connector.
2. Browser OAuth + PKCE login, with device-code fallback.
3. Username reservation and `whoami` command.
4. Encrypted local SQLite database.
5. Local agent identity generation with keychain-backed private key storage.
6. MCP auto-install or generated config for at least one client.
7. Create a workspace directory with Git initialized.
8. Register two local agents by public key.
9. Append signed events to SQLite or JSONL.
10. Add curated markdown search with lean-memory-style indexing.
11. Add task claim/release and patch proposal.
12. Export final workspace bundle.

Then add remote ephemeral hosting:

1. Incus-backed workspace on a non-S1 Hetzner server.
2. Caddy TLS or private WireGuard access.
3. Encrypted server SQLite control database with encrypted off-host backups.
4. Short-lived invite URL and `@username` invite.
5. Agent registration handshake.
6. Workspace TTL and destroy command.

Only after that add disposable execution runners.

## Open Questions

- Should the first public product be MCP-first, CLI-first, or both shipped together?
- Should workspace hosting be self-hosted only at first, or should there be a managed control plane?
- How much should agents be allowed to mutate shared memory without human approval?
- Should private memory live inside the workspace VM, or only on each agent's local machine?
- Should the final export be a Git bundle, a zip, or both?
- Should agent identities be app-global, project-scoped, or both?
- Should agent-to-agent messages exist as first-class objects, or only as thread files and events?

## Current Recommendation

Start with an MCP-first product backed by a CLI.

Use browser OAuth + PKCE for normal CLI login and device authorization for headless login. Give each account a human-friendly username, but use local Ed25519 identities for agent fingerprints. Use short-lived invite links only for bootstrapping. Require proof-of-possession registration. Store all meaningful actions as signed events. Keep the shared workspace as a Git repo with structured markdown. Build semantic search as derived state over curated files, not raw logs.

For storage, use encrypted local SQLite with OS keychain-backed keys, and encrypted server SQLite with encrypted off-host backups for the early control plane. For infrastructure, prototype locally first, then run the first remote version on a non-S1 Hetzner server using Incus. Treat Firecracker as a later optimization for dense disposable execution.
