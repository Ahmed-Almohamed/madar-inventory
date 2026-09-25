# Working with the repository

Repository: [Ahmed-Almohamed/madar-inventory](https://github.com/Ahmed-Almohamed/madar-inventory).

## Clone and run

```sh
git clone https://github.com/Ahmed-Almohamed/madar-inventory.git
cd madar-inventory
npm ci
npm run db:local
npm run dev
```

Use Git Credential Manager or GitHub Desktop if Git asks you to sign in. Keep tokens and passwords out of remote URLs and project files.

## Push a change

```sh
npm run check
npm run build
git status --short
git add <changed-files>
git diff --cached
git commit -m "Describe the change"
git push origin main
```

Review the staged diff before committing. GitHub Actions runs the checks in [check.yml](../.github/workflows/check.yml). Pushing code does not publish the app; deployment is a separate step covered in the [Cloudflare guide](CLOUDFLARE.md).

## What belongs in Git

Commit source code, documentation, migrations, bundled fonts and their licenses, and `package-lock.json`.

The `.gitignore` excludes secrets, `.wrangler/`, database files, backups, exports, `node_modules/`, and build output. SQL migrations are intentionally tracked. Do not force-add ignored customer records or database exports.

Add a new migration for schema changes rather than editing one that has already been applied.
