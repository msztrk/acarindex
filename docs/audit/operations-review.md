# AcarIndex Operations Review

**Audit date:** 2026-07-05  
**Scope:** Beta pilot infrastructure (`acarindex-beta`, `/opt/acarindex`) and deploy scripts in repository

---

## Infrastructure Overview

| Component | Beta state |
|-----------|------------|
| App container | `acarindex-web:pilot` — Up, healthy, port `3002→3000` |
| Postgres | `postgres:16-alpine` — healthy |
| MariaDB (ETL source) | `mariadb:10.11` — healthy |
| Compose file | `docker-compose.pilot.yml` |
| Environment | `/etc/acarindex/pilot.env` |
| Disk `/` | **80–82% used** (57–59G / 75G) |

---

## Deploy Scripts

| Metric | Value |
|--------|-------|
| Script count | **87 files** under `deploy/scripts/` |
| Categories | Beta gates, backup, cutover, Faz 6/6C, RBAC smoke, closure gates |

Key operational scripts referenced in the audit:

- `deploy/scripts/beta/faz-b-operational-closure-gate.sh` — 12-step closure gate
- `deploy/scripts/beta/configure-pilot-b2-storage.sh` — B2 application storage setup
- `deploy/scripts/faz6a1-beta-role-tests.sh` — RBAC smoke
- `deploy/scripts/beta/validate-i18n-beta.sh` — i18n validation
- `deploy/scripts/beta/faz6b2-cleanup-smoke-artifacts.sh` — draft journal cleanup

---

## Backup and Retention

| Item | Detail |
|------|--------|
| Backup directory | `/var/backups/acarindex-pilot` |
| Current size | ≈ **3.0 GB** (2 × ~1.5 GB milestone dumps) |
| Pre-closure backup | `pilot_pg_pre_faz_b_operational_closure_20260704_212344.dump` |
| Retention policy | `pilot-backup-retention` keeps recent milestone dumps |
| Off-site B2 backup | **BLOCKED** — no `B2_BACKUP_KEY_ID` configured (**AUD-016**) |

Disk pressure (80–82%) combined with 3 GB local backups on the same volume is tracked as **AUD-004 (P1)**.

---

## Cron Jobs

| Job | Schedule | Status |
|-----|----------|--------|
| Notification outbox processor | Every 5 minutes | **Installed** on beta |

Outbox cron is active. Real email delivery through Resend was **not proven** in the latest closure attempt (gate aborted before email validation steps).

---

## Logrotate

| Item | Status |
|------|--------|
| Outbox logrotate script | Exists in repository |
| Closure gate behavior | Installs logrotate config if missing |

Log rotation for outbox logs is provisioned but was not independently verified during the truncated closure run.

---

## Faz B Operational Closure Gate

### Current Status: **INCOMPLETE (`CLOSURE=HAYIR`)**

| Field | Value |
|-------|-------|
| Latest log | `/var/log/acarindex-faz-b-closure-20260704_213743.log` |
| Log lines | 86 (truncated) |
| Failure point | Step 2 — `pg_restore: command not found` on host |
| Fix commit | `95152ba` — uses container `pg_restore` |
| Beta deployed fix | **No** — beta still at `dd471eb` |
| Final verdict | Not reached; default `CLOSURE=HAYIR`, `RESULT_*=FAIL` |

### Gate Steps Not Completed (Latest Run)

Steps 3–12 were never executed, including:

- Storage integration tests (18 tests)
- Outbox email verification
- E2E journal application flow
- i18n validation re-run
- Regression smoke
- Final `CLOSURE=EVET` / `CLOSURE=HAYIR` report

---

## B2 Storage — Blocked

| Check | Result |
|-------|--------|
| `APPLICATION_STORAGE_PROVIDER` | `memory` |
| `B2_APPLICATION_KEYS` | **0** (absent from pilot.env) |
| Off-site backup B2 | **BLOCKED** at closure gate step 8 |
| Application attachments in DB | **0 rows** (consistent with memory + restarts) |

B2 configuration is a **P0/P1 blocker** for durable beta operations and off-site backup.

---

## Application Storage

```
APPLICATION_STORAGE_PROVIDER=memory
```

Attachments are stored in a process-local `Map` (`lib/applications/storage/index.ts`). Container restarts wipe all uploaded files. This is **AUD-001 (P0)**.

---

## Migrations

| Metric | Value |
|--------|-------|
| Applied | 15 |
| Pending | 0 |
| Latest | `20260714100000_notification_outbox_faz_b5` |

Schema is current through Faz B5 on beta.

---

## Docker Compose Warnings

**AUD-023 (P3):** `docker compose ps` emits `POSTGRES_USER` warnings when env-file is not passed consistently to compose CLI invocations.

---

## Git Alignment

| Environment | SHA |
|-------------|-----|
| Local / GitHub | `95152ba` |
| Beta | `dd471eb` (1 commit behind) |

Deploy latest `redesign-v2` to beta before re-running closure gate.

---

## Operational Recommendations

### Immediate (Phase 0)

1. Deploy `95152ba` to beta pilot.
2. Configure B2 application storage credentials (or document explicit memory-only beta scope with cleanup policy).
3. Re-run `faz-b-operational-closure-gate.sh` to completion.
4. Verify storage tests, outbox email, E2E flow, i18n validate, regression smoke.

### Short-Term (Phase 1)

5. Run backup retention / disk hygiene.
6. Configure B2 off-site backup credentials.
7. Clean draft journal smoke artifacts.

---

## Related Deliverables

- [Current state audit](./current-state-audit.md)
- [Security review](./security-review.md)
- [Recommended roadmap](./recommended-roadmap.md)
- [Issue register](./issue-register.csv)
