# Local test environment

The integration battery runs the built package inside a real n8n against a real Canvas LMS, both on
your machine. Nothing here touches a production Canvas. Everything in the environment is fake data
(`example.com`, `example.edu`); the passwords and keys in these files are for this throwaway
instance only.

Needs: Docker, Node.js 22, about 25 GB of disk and 8 GB of memory. First set-up takes about an hour,
most of it unattended.

## 1. Canvas

```bash
git clone --depth 1 --branch prod https://github.com/instructure/canvas-lms.git ../canvas-lms
```

```bash
CANVAS_SRC=../canvas-lms test/env/canvas/up.sh build
```

```bash
test/env/canvas/up.sh start
```

`build` makes a Docker image from the Canvas checkout (about 20 minutes; behind a TLS-inspecting
proxy pass `EXTRA_CA_DIR=<dir with ca.crt>`). `start` runs Postgres, Redis, the web server and the
job runner with host networking; the first start creates the database and the admin
(`admin@example.com`, see `canvas/canvas.env`). Canvas then answers on http://localhost:3000.

Other commands: `up.sh status`, `up.sh restart-web` (web server only), `up.sh trim-logs` (Canvas logs
every request and SQL statement; empty the logs now and then), `up.sh stop`.
`CANVAS_WEB_WORKERS` sets the number of web server processes (default 3): Canvas serves one request
per process at a time, and the battery runs test files in parallel.

## 2. Seed data

```bash
test/env/canvas/seed/run.sh
```

Loads a large, deliberately messy data set (hundreds of users, about a hundred courses, tens of
thousands of submissions; see `canvas/seed/README.md`) and writes the persona tokens and the IDs of
the seeded records to `test/.state.json` (git-ignored). The script can be re-run: finished steps are
skipped. A full run takes roughly 25 minutes.

## 3. n8n

```bash
mkdir -p ../n8n-battery && (cd ../n8n-battery && npm init -y >/dev/null && npm install n8n@2.4.6)
```

```bash
N8N_DIR=../n8n-battery N8N_HOME=../n8n-battery/home test/env/n8n/reload.sh
```

```bash
npx tsx test/env/n8n/bootstrap.ts
```

`reload.sh` builds this package, installs the packed tarball into n8n's community-node folder (the
way the README tells users to install it) and (re)starts n8n on http://localhost:5678. Run it again
after every change under `nodes/` or `credentials/`, but never while a test run is in progress.
`bootstrap.ts` creates the n8n owner (`owner@example.com`), an API key and the Canvas credentials,
including one token per persona for each parallel test worker; it needs `docker exec` access to the
`canvas-web` container for that.

## 4. Run

```bash
npm run test:integration
```

```bash
npx vitest run --config vitest.integration.config.ts test/integration/course.test.ts
```

See `test/README.md` for how the tests are written, the options (`BATTERY_WORKERS`, ...) and the
reports that are generated from a run.

## Several checkouts at once

`dev-worktree.sh up|reload|sync|down` gives a git worktree its own n8n instance on its own port
(`N8N_PORT`), sharing the one Canvas. That is how several people or agents can work on different
resources at the same time without restarting each other's n8n.
