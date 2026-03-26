# Deploy on EC2 (Amazon Linux/Ubuntu) - Eduno Exam

This deploy flow runs your app on EC2 behind Nginx with PM2 auto-restart, and supports auto-deploy from GitHub on every push.

## 1) EC2 prerequisites

- Amazon Linux 2023 or Ubuntu 22.04/24.04
- Security Group inbound:
  - `22` (SSH)
  - `80` (HTTP)
  - `443` (HTTPS, optional for SSL)

## 2) Copy code to EC2

SSH into EC2 (Amazon Linux default user is `ec2-user`):

```bash
ssh -i /path/to/key.pem ec2-user@<EC2_PUBLIC_IP>
```

Create app directory and copy project:

```bash
sudo mkdir -p /var/www/eduno-exam
sudo chown -R $USER:$USER /var/www/eduno-exam
```

Then either:

- `git clone` into `/var/www/eduno-exam`, or
- upload ZIP and extract into `/var/www/eduno-exam`

## 3) One-time server setup

```bash
cd /var/www/eduno-exam
chmod +x deploy/ec2/setup-server.sh deploy/ec2/deploy-app.sh deploy/ec2/enable-nginx.sh
./deploy/ec2/setup-server.sh
```

## 4) Configure environment

```bash
cp .env.example .env
nano .env
```

Set at least:

- `DATABASE_URL="file:./prisma/prod.db"`
- `AUTH_SECRET="<strong-random-secret>"`
- `OPENAI_API_KEY="<your-key>"` (optional but recommended for AI extraction)

On first deployment, if no users exist, deploy script auto-seeds default accounts:

- Admin: `admin@eduno.local` / `admin123`
- School: `school@demo.local` / `school123`

## 5) Build + start app

```bash
./deploy/ec2/deploy-app.sh
./deploy/ec2/enable-nginx.sh
```

App becomes available at:

- `http://<EC2_PUBLIC_IP>`

## 6) Update deployment later

After code changes:

```bash
cd /var/www/eduno-exam
git pull
./deploy/ec2/deploy-app.sh
```

## 7) Auto-deploy pipeline (GitHub -> EC2)

Workflow file:

- `.github/workflows/deploy-ec2.yml`

Required GitHub repository secrets:

- `EC2_HOST` -> your public IP (example `65.0.125.186`)
- `EC2_USER` -> `ec2-user`
- `EC2_SSH_KEY` -> full private key content (PEM text)
- `EC2_ENV_FILE` -> full `.env` file content for server

After setting secrets:

1. Push code to `main`
2. Workflow `Deploy To EC2` runs automatically
3. EC2 server pulls latest git code and redeploys

You can also run it manually from Actions using `workflow_dispatch`.

## 8) Useful commands

```bash
pm2 status
pm2 logs eduno-exam
pm2 restart eduno-exam
sudo systemctl status nginx
```

## 9) Enable HTTPS (recommended)

If you have a domain pointing to EC2:

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

After SSL is enabled, use:

- `https://yourdomain.com`
