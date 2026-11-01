<div align="center">
  <img src="public/favicon.svg" width="64" height="64" alt="Madar logo">
  <h1>Madar Inventory</h1>
  <p>Sales, stock, and installation records for a GPS device business.</p>

  ![JavaScript](https://img.shields.io/badge/JavaScript-ES_modules-F7DF1E?logo=javascript&logoColor=111827)
  ![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)
  ![Cloudflare D1](https://img.shields.io/badge/Database-D1-F38020?logo=cloudflare&logoColor=white)
  ![Languages](https://img.shields.io/badge/UI-Arabic_%2F_English-191970)

  [Getting started](#-getting-started) · [Deployment](docs/CLOUDFLARE.md) · [Repository guide](docs/GITHUB.md)
</div>

---

Madar keeps device sales, warehouse quantities, customers, and installation technicians in one place. Built for a small team selling GPS trackers, with an Arabic/English interface that works on phones and desktops.

The app opens on **Overview**, with current-month sales metrics, current stock, recent sales and warehouse distribution. The sidebar separates **Sales**, **Customers**, **Devices**, **Warehouses**, **Technicians**, and **Reports**. Customers contains a searchable directory and a separate purchase-history tab. Directory details and notes are available through each row's details action; these records remain independent of sales and stock. Reports links to the existing sales, purchase, technician and stock-history views.

## 📦 What it does

| Area | Features |
| --- | --- |
| **Sales** | Record and edit sales, optional installation and shipping fees, customer self-installation, and cancellation with stock restoration. |
| **Inventory** | Edit device names, prices, and photos. Manage warehouses, governorates, technician links, and quantities. |
| **Customers** | Search contact details and purchase history. Reuse a returning customer's details when recording a sale. |
| **Technicians** | Edit profiles and warehouse links. View installations and related warehouse sales. |
| **SIM cards** | Add one optional $5 SIM per sale, with a searchable code unique among active sales. |
| **Reports** | Filter sales, export matching sales or customers to CSV, and review stock changes with before/after quantities. |

## 🚀 Getting started

Requires **Node.js 24** and npm.

```sh
npm ci
npm run db:local
npm run dev
```

Open [localhost:8787](http://127.0.0.1:8787). A fresh database starts empty: add a device, create a warehouse with stock, then record a sale. After applying migrations, provision an initial administrator with scripts/provision-admin.mjs (JSON on stdin), then execute the generated ignored backups/admin-bootstrap.sql against the chosen database. Passwords and generated SQL must never be committed. Existing usernames are not overwritten.

## 🛠 Development

Plain JavaScript, HTML, and CSS on the frontend; a Cloudflare Worker serves the API and static assets. Data lives in D1. Fonts are bundled locally.

```text
public/              UI, translations, styles, and fonts
src/worker.js        API and request handling
migrations/          Ordered D1 schema migrations
tests/               In-memory SQLite tests
docs/                Deployment and repository guides
scripts/             Local setup and import helpers
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local app |
| `npm run db:local` | Apply local migrations |
| `npm run check` | Check syntax and run tests |
| `npm run build` | Dry-run the Worker deployment |
| `npm run db:remote` | Apply production migrations |
| `npm run deploy` | Publish the Worker and frontend |

GitHub Actions runs checks and a deployment dry run on pushes and pull requests. It does **not** deploy the app or copy database records.

## ☁️ Deployment

See the [Cloudflare guide](docs/CLOUDFLARE.md) for setup, migrations, and backups. Production uses `wrangler.jsonc`; local development uses `wrangler.local.jsonc`.

For an existing installation, back up D1 before applying migrations and deploying:

```sh
npm run check
npm run build
npm run db:remote
npm run deploy
```

**Access model:** every API route, including product images, requires an active session. Administrators create employee accounts and can disable them or reset their passwords. Employees can operate the shared business workspace but cannot manage accounts. Sessions expire after 12 hours, use HttpOnly/SameSite cookies, and are revoked when an employee account changes. Passwords use salted PBKDF2-SHA256 hashes. Login attempts are rate-limited.

## 📝 How records work

- Customer history is grouped by phone number, ignoring spaces, hyphens, parentheses, and `+`. Use consistent country prefixes. The latest matching sale supplies the displayed contact details.
- Installation, shipping, and the optional SIM charge apply to the whole sale. Existing sale prices stay unchanged when a device's default price changes.
- Cancelling a sale restores stock once. Editing a cancelled record does not reactivate it.
- Technician reports include installations and sales from their **currently linked** warehouses. A shared warehouse sale does not identify the technician as its seller.
- Date and search filters apply to CSV exports across all result pages. Customer date filters also limit the purchases included in customer totals. Apply filters with **Search** before exporting.
- Stock history starts when migration `0007` is applied. It records subsequent quantity changes in UTC; earlier history is not reconstructed.
- Photos accept JPG, PNG, or WebP up to 10 MB and are compressed to JPEG, at most 200 KB, before storage.

## Credits

Built by **[Sy0s](https://github.com/Ahmed-Almohamed)**.

Font licenses are included in [Cairo](public/CAIRO-LICENSE.txt), [Inter](public/INTER-LICENSE.txt), and [FONT-LICENSE.txt](public/FONT-LICENSE.txt). No open-source license has been assigned to the application code.

## Technician stock

Each technician has a separate custody location by default. Workplace assignments do not share balances. An explicit stock-mode setting can make a technician use the same balance as a regular warehouse. New personal locations start empty; migration 0009 preserves existing quantities and sales at their original locations. Transfer stock to custody as needed. Transfers are atomic, reject insufficient balances and are safe to retry. Sales deduct from the explicitly selected stock source, independently of the installer. A nonempty personal balance must be transferred before switching to shared mode; later returns to a previous personal location remain visible.

## Expenses and accountability

Syria branch expenses record amount, USD/SYP currency, payment date, details and the authenticated employee. Totals are separate per currency. Expense creation is retry-safe. Successful business writes and their activity entries commit atomically. Sales details show the creating employee; historical records are explicitly unattributed. Activity records exclude passwords and image data. Employee IDs supplied by clients cannot override the authenticated actor.

Odoo synchronization mirrors all business records and their changes to the Syria branch, with durable delivery, automatic retries and an admin status screen. This is a data mirror, not native accounting posting. See [Odoo synchronization](docs/ODOO-PLAN.md).
