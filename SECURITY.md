# Security Policy

## Scope

This repository maintains the `sub_ms` changes documented in
[LOCAL_CHANGES.md](LOCAL_CHANGES.md). Upstream provenance and third-party notices
are retained. A successful CI run is not a security certification.

## Reporting

Do not post credentials, private account data, exploitable details, or production
configuration in public issues or pull requests.

Use GitHub's private vulnerability-reporting entry on this repository's Security
page when it is available. If it is not enabled, open an issue requesting a
private contact channel **without** including vulnerability details, and wait for
the maintainer to establish one. This repository does not promise a response SLA.

Report the exact version/source commit, affected path and account type, impact,
and a minimal synthetic reproduction. Describe what was actually tested; do not
test against someone else's deployment.

## Credentials and Deployment

- Never commit `.env`, tokens, OAuth exports, TOTP seeds, proxy passwords, private
  keys, database backups, production logs, or local runtime snapshots.
- If a credential leaks, revoke or rotate it first. Deleting a file or editing
  an issue does not erase it from Git history or downloaded copies.
- CI in this fork must not receive production SSH credentials or use production
  databases. Mocked tests and isolated disposable environments are preferred.
- Source publication does not authorize production rollout. Review database
  migrations, persistence, health checks and rollback compatibility separately.

See [CONTRIBUTING.md](CONTRIBUTING.md) for sanitization and review requirements.
