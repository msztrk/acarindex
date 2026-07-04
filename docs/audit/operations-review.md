# AcarIndex Operations Review

**Audit date:** 2026-07-05  
**Scope:** Beta pilot (`acarindex-beta`, `/opt/acarindex`, `/etc/acarindex/pilot.env`)

---

## §20 Infrastructure Overview

| Component | Beta state |
|-----------|------------|
| App | `acarindex_pilot_app` — Up, healthy, `:3002→3000` |
| Postgres | `acarindex_pilot_pg` — `postgres:16-alpine`, healthy |
| MariaDB (ETL) | `acarindex_pilot_mysql` — `mariadb:10.11`, healthy |
| Prod (same host) | `acarindex_prod_app`, `acarindex_prod_pg` — **not in audit scope** |
| Compose | `docker-compose.pilot.yml` + `/etc/acarindex/pilot.env` |
| Disk `/` | **86%** (62G / 75G) |
| Volumes | `acarindex-pilot_pilot_pg_data`, `acarindex-pilot_pilot_mysql_data` |

---

## Deploy Scripts

| Metric | Value |
|--------|-------|
| Script count | **87** under `deploy/scripts/` |
| Key gates | `faz-b-operational-closure-gate.sh`, `faz-b2-beta-storage-tests.sh`, `validate-i18n-beta.sh` |

---

## §20 Backup and Retention

| Item | Detail |
|------|--------|
| Directory | `/var/backups/acarindex-pilot` |
| Size | **≈ 7.5 GB** (grown from ~3 GB since prior audit) |
| Pre-closure dump | `pilot_pg_pre_faz_b_operational_closure_20260704_222009.dump` |
| Retention | `pilot-backup-retention` policy in deploy scripts |
| Off-site B2 | **BLOCKED** — AUD-018 |

**AUD-004 (P1):** 86% disk + large local backups on same volume.

---

## §20 Cron Jobs

| Job | Schedule | Status |
|-----|----------|--------|
| Notification outbox | `*/5 * * * *` | **Installed** |

Crontab entry runs `docker compose … run --rm etl scripts/process-notification-outbox.ts` logging to `/var/log/acarindex-outbox.log`.

Real email delivery: **not verified** — closure gate outbox email step FAIL (AUD-016).

---

## Logrotate

Outbox logrotate script exists in repository; closure gate installs if missing. Not independently verified this audit.

---

## §20 Faz B Operational Closure Gate

### Status: **`CLOSURE=HAYIR`**

Latest complete run: `/var/log/acarindex-faz-b-closure-20260704_222004.log` (Jul 4 22:27 UTC, 247 lines).

| Step | Result |
|------|--------|
| Pre-check | OK |
| Pre-work backup | OK |
| B2 application storage | **BLOCKED** |
| Storage tests (18) | **FAIL** |
| Outbox real email | **FAIL** |
| E2E journal + publish | **FAIL** |
| Journal status audit | Executed |
| Off-site B2 backup | **BLOCKED** |
| i18n validate | **PASS** |
| Regression (beta) | **PASS** |
| Final | **`CLOSURE=HAYIR`** |

Prior aborted run (`213743.log`, 86 lines, host `pg_restore` failure) superseded — beta now at `95152ba` with container `pg_restore` fix.

Blocker note: B2 browser credential setup blocked by unavailable Cursor IDE Browser MCP during automated setup workflow.

---

## Application Storage

```
APPLICATION_STORAGE_PROVIDER=memory
NODE_ENV=production
```

In-memory `Map` store — **AUD-001 (P0)**. Attachments non-durable.

---

## Migrations

| Metric | Beta value |
|--------|------------|
| Applied | 15 |
| Pending | 0 |
| Latest | `20260714100000_notification_outbox_faz_b5` |

---

## Docker Compose Warnings

**AUD-027 (P3):** `POSTGRES_USER` warnings when compose invoked without `--env-file /etc/acarindex/pilot.env`.

---

## Git Alignment

| Environment | SHA |
|-------------|-----|
| Local / GitHub | `f3d0965` |
| Beta | `95152ba` (1 commit behind) |

Deploy `f3d0965` before next closure run (includes closure hotfixes + unique test ISSN generation).

---

## §20 Operational Recommendations

### Immediate (Phase 0)

1. Deploy `f3d0965` to beta.
2. Configure B2 application storage (manual Backblaze setup if MCP unavailable).
3. Re-run `faz-b-operational-closure-gate.sh` to `CLOSURE=EVET`.
4. Verify storage tests, outbox email, E2E flow.

### Short-term (Phase 1)

5. Backup retention — reduce 7.5G footprint.
6. Configure B2 off-site backup.
7. Clean draft journal smoke artifacts (`faz6b2-cleanup-smoke-artifacts.sh`).

---

## Related Deliverables

- [Current state audit](./current-state-audit.md)
- [Security review](./security-review.md)
- [Recommended roadmap](./recommended-roadmap.md)
