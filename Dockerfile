# Pulso: Node 22 + Chromium (desenha os quadros do vídeo) + ffmpeg (monta o MP4).
# O projeto não tem dependências npm, então não há "npm install".
FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium ffmpeg fonts-dejavu-core ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# TZ: o "Hoje" do painel e as datas seguem o horário de Brasília (o Node traz os fusos no próprio ICU)
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data \
    CHROME_PATH=/usr/bin/chromium \
    TZ=America/Sao_Paulo

WORKDIR /app
COPY . .
RUN mkdir -p /data

EXPOSE 3000
CMD ["node", "--disable-warning=ExperimentalWarning", "server.js"]
