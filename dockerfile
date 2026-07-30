FROM node:20-bullseye

# System paketleri (Rust, FFmpeg, ALSA, Build araçları)
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    ffmpeg \
    libasound2-dev \
    pkg-config \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Rust ve Cargo Kurulumu
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Librespot (Spotify İstemcisi) Kurulumu
RUN cargo install librespot

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

CMD ["node", "index.js"]
