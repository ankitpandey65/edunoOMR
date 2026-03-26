# Eduno Exam

Next.js-based OMR generation, scanning, and score management platform.

## Standard Team Pipeline (Local -> Git -> Local)

If this folder is not a git repo yet:

```bash
git init
git add .
git commit -m "Initial project setup"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

### 1) Clone

```bash
git clone <your-repo-url>
cd EdunoExam
```

### 2) Create environment file

```bash
cp .env.example .env
```

Edit `.env` and set:

- `AUTH_SECRET` (required)
- `OPENAI_API_KEY` (optional but recommended for AI-assisted extraction)

### 3) One-command run (Docker)

```bash
docker compose up -d --build
```

Open app:

- [http://localhost:3000](http://localhost:3000)

Stop app:

```bash
docker compose down
```

### 4) Update local version after pulling new code

```bash
git pull
docker compose up -d --build
```

This automatically rebuilds and installs all dependencies inside Docker.

## NPM helper commands

```bash
npm run docker:up
npm run docker:down
npm run docker:logs
npm run docker:restart
npm run docker:image:up
npm run docker:image:down
```

## Git workflow recommendation

- Create branch: `feature/<name>`
- Commit and push
- Open Pull Request
- CI workflow (`.github/workflows/ci.yml`) validates build and Docker image
- Merge to `main`

## Data persistence

Docker volumes are used:

- `eduno_prisma` for SQLite DB
- `eduno_uploads` for uploaded files

So data survives container restarts.

## Run from prebuilt GHCR image (no local build)

After the `Publish Docker Image` workflow runs on `main`, teammates can run the app directly from GHCR image:

1) Set your image once (replace `OWNER`):

```bash
export EDUNO_IMAGE=ghcr.io/OWNER/eduno-exam:latest
```

2) Run:

```bash
cp .env.example .env
npm run docker:image:up
```

Stop:

```bash
npm run docker:image:down
```
