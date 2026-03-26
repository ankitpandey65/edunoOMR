FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN python3 -m pip install --no-cache-dir pymupdf pillow

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN chmod +x docker/start.sh

RUN npm run db:generate && npm run build

EXPOSE 3000

CMD ["./docker/start.sh"]
