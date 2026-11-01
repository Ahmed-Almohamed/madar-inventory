# Odoo synchronization

Madar sends a complete one-way business-data mirror to birq.odoo.com, branch **مدار — فرع سوريا** (company 3). Odoo 20 JSON-2 API access was verified. The standalone key was created with the user's explicit approval; its secret is never committed.

## Scope

The Odoo **مدار — سوريا** application has **بيانات مدار** (current records) and **سجل التغييرات** (every committed version). Covers devices, photos, warehouses, technician custody, workplace assignments, balances, sales and cancellations, stock movements/history/transfers, customer directory, expenses, employee identities and attributed activity. Customer purchase history is represented by complete sales records. Passwords, password hashes, sessions and authentication logs are excluded.

This is a data mirror, not Odoo-native sale orders, invoices, stock pickings, or posted accounting. Original USD/SYP amounts remain intact in the payload and formatted details; the parent company's SAR currency and accounting configuration are unchanged. Edit records in Madar; future delivery uses Madar as the source.

## Reliability

- Migration 0011 snapshots existing business records and installs INSERT/UPDATE/DELETE triggers. Every changed row and its immutable payload enter the outbox in the business transaction. Rollbacks produce no outgoing events.
- The audit wrapper sets and clears the responsible employee in that transaction, including stock-trigger changes.
- Worker waitUntil starts delivery after successful writes. A one-minute cron drains work without an open browser. Failures retry with backoff up to 15 minutes; pending events are retained.
- A database lease serializes delivery. Imports use stable external IDs (database instance + record key/event ID). Retries update the same Odoo row. Current records collapse repeated versions within a batch; history retains every version.
- Both record and history imports must succeed before acknowledgment. Deletions remain visible with a deleted flag.
- Admin-only **ربط Odoo** shows pending/delivered counts, last delivery, errors and retry. It refreshes every 15 seconds while open.

## Configuration

ODOO_ENABLED, ODOO_URL, ODOO_COMPANY_ID and ODOO_SOURCE are nonsecret Worker variables. ODOO_API_KEY is a Cloudflare Worker secret. Local development leaves synchronization disabled to avoid mixing test and production data. Each database has a unique replication namespace.

scripts/provision-odoo.mjs --apply additively provisions Odoo 20 models/views/menu. It reads the key from the environment or ignored backups/odoo-key.txt. Access is restricted to the existing administrator group and the companies assigned to that user, independently of the active company in each browser. Both the parent-company and Syria-branch contexts were verified. Current records hide deleted entries; change history retains their audit versions. The existing Salla integration is untouched.

The key inherits the existing account's administrator permissions. A dedicated branch-limited integration account is recommended later. To rotate, replace the Worker secret and revoke the old key in Odoo. Do not delete pending outbox data. The connection-test expense mirror is labeled **اختبار الربط** and is not an accounting entry.

Official reference: https://www.odoo.com/documentation/19.0/developer/reference/external_api.html
