FROM node:20-bullseye

# System paketleri (Rust, FFmpeg, ALSA, Git, Clang)
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    ffmpeg \
    libasound2-dev \
    pkg-config \
    python3 \
    git \
    clang \
    libclang-dev \
    && rm -rf /var/lib/apt/lists/*

# Rust ve Cargo Kurulumu
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Librespot'u Doğrudan Kaynak Koddan Derleme (Çakışmaları Önler)
RUN git clone --depth 1 https://github.com/librespot-org/librespot.git /tmp/librespot \
    && cd /tmp/librespot \
    && cargo build --release \
    && cp target/release/librespot /usr/local/bin/ \
    && rm -rf /tmp/librespot

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

CMD ["node", "index.js"]
