require('dotenv').config();
const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  EmbedBuilder, 
  PermissionFlagsBits,
  ChannelType
} = require('discord.js');
const { 
  joinVoiceChannel, 
  getVoiceConnection, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus, 
  NoSubscriberBehavior 
} = require('@discordjs/voice');
const http = require('http');
const fs = require('fs');
const SpotifyWebApi = require('spotify-web-api-node');
const play = require('play-dl');

// 💾 YEREL JSON VERİTABANI SİSTEMİ
const dbFile = './database.json';
if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, JSON.stringify({ users: {}, market: { silver: 100, gold: 500, diamond: 2000 } }));
}

const readDb = () => {
    try { return JSON.parse(fs.readFileSync(dbFile, 'utf8')); } catch { return { users: {}, market: { silver: 100, gold: 500, diamond: 2000 } }; }
};

const writeDb = (data) => {
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
};

function getUserData(userId) {
    const data = readDb();
    if (!data.users[userId]) {
        data.users[userId] = {
            balance: 500,
            job: null,
            level: 1,
            xp: 0,
            inventory: [],
            marriage: null,
            lastWork: 0,
            investments: { silver: 0, gold: 0, diamond: 0 }
        };
        writeDb(data);
    }
    return data.users[userId];
}

function updateUserData(userId, updater) {
    const data = readDb();
    if (!data.users[userId]) getUserData(userId);
    updater(data.users[userId]);
    writeDb(data);
}

function getMarket() {
    const data = readDb();
    if (!data.market) {
        data.market = { silver: 100, gold: 500, diamond: 2000 };
        writeDb(data);
    }
    return data.market;
}

function updateMarket() {
    const data = readDb();
    if (!data.market) data.market = { silver: 100, gold: 500, diamond: 2000 };
    
    // Fiyatlarda %-10 ile %+10 arası dalgalanma
    const change = (price) => {
        const factor = 1 + (Math.random() * 0.2 - 0.10);
        return Math.max(10, Math.round(price * factor));
    };

    data.market.silver = change(data.market.silver);
    data.market.gold = change(data.market.gold);
    data.market.diamond = change(data.market.diamond);
    writeDb(data);
}

// 5 Dakikada Bir Borsa Fiyatlarını Güncelle
setInterval(updateMarket, 5 * 60 * 1000);

// 🎵 SPOTIFY API YAPILANDIRMASI
const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:8888'
});

async function spotifyTokenAl() {
    try {
        const data = await spotifyApi.clientCredentialsGrant();
        spotifyApi.setAccessToken(data.body['access_token']);
        console.log('🎵 Spotify Token başarıyla alındı!');
        setTimeout(spotifyTokenAl, (data.body['expires_in'] - 60) * 1000);
    } catch (err) {
        console.error('❌ Spotify token hatası:', err.message);
    }
}

// Render Uptime Web Sunucusu
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end("Bot 7/24 Aktif!");
}).listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web sunucusu ${PORT} portunda dinleniyor.`);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
});

// 💾 SES OYNATICI VE SIRA (QUEUE) SİSTEMİ
const queues = new Map();
const copyCache = new Map();
const tempChannels = new Set();
const userMessageMap = new Map();

const levelTexts = [
    "Alev aldın resmen! Seviye atladın, gözlerim kamaşıyor. 🔥",
    "Bu ne tatlılık? Yeni seviyen hayırlı olsun güzelim. 😉",
    "Sen seviye atladıkça kalbim daha hızlı çarpıyor, farkında mısın? ❤️",
    "Buralar seninle güzelleşiyor... Tebrikler, seviye atladın! ✨",
    "Senin bu mesaj hızına ve cazibene yetişilmiyor! Yeni level kutlu olsun. 😘",
    "Level atlamanın bile bir karizması var sende... 😉",
    "Yine döktürüyorsun, bakışlarınla seviyeleri devirdin! 💥",
    "Kalp hırsızı mısın yoksa sadece çok mu aktifsin? Seviye atladın! ❤️‍🔥",
    "Seninle her seviye bir başka güzel... Tebrikler! 🌹",
    "Eriyorum galiba... Bu ne karizma, yeni seviyene selam olsun! 🥰"
];

const JOBS = {
    "sanayi": { name: "Sanayi", basePay: 150 },
    "sahte_ayakkabi": { name: "Sahte Ayakkabıcı", basePay: 350 },
    "eskort": { name: "Eskort", basePay: 800 },
    "spotify": { name: "Spotify Artist", basePay: 1800 }
};

const MARKET_ITEMS = {
    "yuzuk": { name: "Evlilik Yüzüğü", price: 5000 }
};

async function playSong(guildId) {
    const serverQueue = queues.get(guildId);
    if (!serverQueue || serverQueue.songs.length === 0) {
        serverQueue.playing = false;
        return;
    }

    const currentSong = serverQueue.songs[0];
    try {
        const ytSearch = await play.search(`${currentSong.artist} - ${currentSong.title}`, { limit: 1 });
        if (!ytSearch || ytSearch.length === 0) {
            serverQueue.textChannel.send(`❌ **${currentSong.title}** ses kaynağı bulunamadı, atlanıyor...`);
            serverQueue.songs.shift();
            return playSong(guildId);
        }

        const stream = await play.stream(ytSearch[0].url);
        const resource = createAudioResource(stream.stream, { inputType: stream.type });

        serverQueue.player.play(resource);
        serverQueue.connection.subscribe(serverQueue.player);
        serverQueue.playing = true;

        const embed = new EmbedBuilder()
            .setTitle(`🎶 Şimdi Çalıyor: ${currentSong.title}`)
            .setURL(currentSong.url)
            .setColor('#1DB954')
            .addFields(
                { name: '👤 Sanatçı', value: currentSong.artist, inline: true },
                { name: '🔁 Döngü Modu', value: serverQueue.loop.toUpperCase(), inline: true }
            )
            .setThumbnail(currentSong.thumbnail)
            .setFooter({ text: '7/24 Kesintisiz Ses Sistemi' });

        serverQueue.textChannel.send({ embeds: [embed] });
    } catch (err) {
        console.error('Oynatma hatası:', err);
        serverQueue.songs.shift();
        playSong(guildId);
    }
}

client.once('ready', () => {
  console.log(`🤖 Bot ${client.user.tag} olarak başarıyla aktifleşti!`);
  spotifyTokenAl();
});

process.on('unhandledRejection', error => {
    console.error('Unhandled Promise Rejection:', error);
});

// ➕ GEÇİCİ SES ODASI SİSTEMİ
client.on('voiceStateUpdate', async (oldState, newState) => {
    if (newState.channel && newState.channel.name.includes('➕ Oda Oluştur')) {
        try {
            const createdChannel = await newState.guild.channels.create({
                name: `🔊 ${newState.member.user.username}'in Odası`,
                type: ChannelType.GuildVoice,
                parent: newState.channel.parentId || null
            });
            await newState.setChannel(createdChannel);
            tempChannels.add(createdChannel.id);
        } catch (err) { console.error(err); }
    }

    if (oldState.channel && tempChannels.has(oldState.channel.id)) {
        if (oldState.channel.members.size === 0) {
            try {
                tempChannels.delete(oldState.channel.id);
                await oldState.channel.delete();
            } catch (err) { console.error(err); }
        }
    }
});

// 💬 MESAJ & KOMUT MANTIĞI
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // Anti-Spam
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        const userId = message.author.id;
        const now = Date.now();
        if (userMessageMap.has(userId)) {
            const times = userMessageMap.get(userId).filter(t => now - t < 5000);
            times.push(now);
            userMessageMap.set(userId, times);
            if (times.length >= 5) {
                try {
                    await message.delete();
                    if (message.member.moderatable) {
                        await message.member.timeout(60000, 'Spam Engeli');
                        const m = await message.channel.send(`⚠️ ${message.author}, çok hızlı mesaj attığın için 1 dakika susturuldun!`);
                        setTimeout(() => m.delete().catch(() => {}), 5000);
                    }
                } catch (e) {}
                userMessageMap.delete(userId);
                return;
            }
        } else {
            userMessageMap.set(userId, [now]);
        }
    }

    // XP ve Seviye Sistemi
    const userId = message.author.id;
    updateUserData(userId, (u) => {
        u.xp += 10;
        if (u.xp >= 100) {
            u.level += 1;
            u.xp = 0;
            const randomText = levelTexts[Math.floor(Math.random() * levelTexts.length)];
            message.channel.send(`🎉 **Tebrikler ${message.author}!** Level **${u.level}** oldun!\n> *${randomText}*`).catch(() => {});
        }
    });

    const lowerText = message.content.toLowerCase().trim();
    if (['sa', 'sea', 'selam', 'selamunaleykum', 'selamın aleyküm'].includes(lowerText)) {
        return message.reply(`Aleykümselam **${message.author.username}**, hoş geldin! 👋`);
    }

    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // 📋 SUNUCU YÖNETİM KOMUTLARI
    if (command === 'sunucu-kopyala') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('❌ Yetkin yok!');
        const guild = message.guild;
        const roles = guild.roles.cache.map(r => ({ name: r.name, color: r.color })).filter(r => r.name !== '@everyone');
        const channels = guild.channels.cache.map(c => ({ name: c.name, type: c.type }));

        copyCache.set(userId, { name: guild.name, roles, channels });
        return message.reply('📋 **Sunucu rolleri, odaları ve yapısı hafızaya kopyalandı!**');
    }

    if (command === 'sunucu-yapistir') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('❌ Yetkin yok!');
        const data = copyCache.get(userId);
        if (!data) return message.reply('❌ Önce bir sunucuyu `!sunucu-kopyala` ile kopyalaman lazım!');

        message.reply('🔄 Kopyalanan yapılar bu sunucuya aktarılıyor...');
        for (let r of data.roles) {
            await message.guild.roles.create({ name: r.name, color: r.color }).catch(() => {});
        }
        for (let c of data.channels) {
            await message.guild.channels.create({ name: c.name, type: c.type }).catch(() => {});
        }
        return message.channel.send('✅ **Sunucu yapısı başarıyla aktarıldı!**');
    }

    if (command === 'sunucu-dagit') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('❌ Yetkin yok!');
        message.reply('🚨 **Sunucu sıfırlanıyor ve dağıtılıyor...**');
        message.guild.channels.cache.forEach(c => c.delete().catch(() => {}));
        message.guild.members.cache.forEach(m => {
            if (m.bannable && m.id !== message.author.id) m.kick().catch(() => {});
        });
        return;
    }

    // 💼 EKONOMİ & ÇALIŞMA
    if (command === 'is-sec') {
        const secim = args[0]?.toLowerCase();
        if (!JOBS[secim]) return message.reply('❌ Geçerli işler: `sanayi`, `sahte_ayakkabi`, `eskort`, `spotify`');

        updateUserData(userId, (u) => { u.job = secim; });
        return message.reply(`💼 Tebrikler! Artık **${JOBS[secim].name}** olarak çalışıyorsun.`);
    }

    if (command === 'calis') {
        const userData = getUserData(userId);
        if (!userData.job) return message.reply('❌ Önce bir işe girmelisin! Örn: `!is-sec sanayi`');

        const cooldown = 5 * 60 * 1000; // 5 Dakika
        const now = Date.now();
        if (now - userData.lastWork < cooldown) {
            const kalan = Math.ceil((cooldown - (now - userData.lastWork)) / 1000);
            return message.reply(`⏳ Biraz dinlen! **${kalan} saniye** sonra tekrar çalışabilirsin.`);
        }

        const basePay = JOBS[userData.job].basePay;
        const levelBoost = 1 + ((userData.level - 1) * 0.03); // Her level %3 zam
        const earned = Math.round(basePay * levelBoost);

        updateUserData(userId, (u) => {
            u.balance += earned;
            u.lastWork = now;
        });

        return message.reply(`💵 Mesai bitti! **${earned} FAM Coin** kazandın. (Level Zammı: %${((userData.level - 1) * 3)})`);
    }

    if (command === 'para-gonder') {
        const target = message.mentions.users.first();
        const amount = parseInt(args[1]);
        if (!target || isNaN(amount) || amount <= 0) return message.reply('❌ Kullanım: `!para-gonder @kullanici miktar`');

        const senderData = getUserData(userId);
        if (senderData.balance < amount) return message.reply('❌ Yeterli FAM Coin\'in yok!');

        updateUserData(userId, (u) => { u.balance -= amount; });
        updateUserData(target.id, (u) => { u.balance += amount; });

        return message.reply(`💸 **${target.username}** kişisine **${amount} FAM Coin** gönderildi!`);
    }

    // 💍 MAĞAZA, EVLİLİK VE PROFİL
    if (command === 'magaza') {
        return message.reply('🏪 **FAM Mağaza:**\n1. `yuzuk` - 5,000 FAM Coin (`!satin-al yuzuk`)');
    }

    if (command === 'satin-al') {
        const item = args[0]?.toLowerCase();
        if (!MARKET_ITEMS[item]) return message.reply('❌ Mağazada böyle bir ürün yok.');

        const uData = getUserData(userId);
        if (uData.balance < MARKET_ITEMS[item].price) return message.reply('❌ Paranız yetmiyor!');

        updateUserData(userId, (u) => {
            u.balance -= MARKET_ITEMS[item].price;
            u.inventory.push(item);
        });

        return message.reply(`🎉 Başarıyla **${MARKET_ITEMS[item].name}** satın aldınız!`);
    }

    if (command === 'evlen') {
        const target = message.mentions.users.first();
        if (!target || target.id === userId) return message.reply('❌ Evlenmek istediğin kişiyi etiketlemelisin!');

        const myData = getUserData(userId);
        const targetData = getUserData(target.id);

        if (!myData.inventory.includes('yuzuk')) return message.reply('❌ Evlenmek için önce mağazadan yüzük almalısın (`!satin-al yuzuk`)!');
        if (myData.marriage || targetData.marriage) return message.reply('❌ Taraflardan biri zaten evli!');

        const mDate = Date.now();
        updateUserData(userId, (u) => {
            u.marriage = { partner: target.id, date: mDate };
            u.inventory = u.inventory.filter(i => i !== 'yuzuk');
        });
        updateUserData(target.id, (u) => {
            u.marriage = { partner: userId, date: mDate };
        });

        return message.reply(`👩‍❤️‍👨 **Tebrikler!** ${message.author} ve ${target} resmen evlendi! 🎉`);
    }

    if (command === 'profil') {
        const target = message.mentions.users.first() || message.author;
        const u = getUserData(target.id);

        let marriageText = "Bekar";
        if (u.marriage) {
            const days = Math.floor((Date.now() - u.marriage.date) / (1000 * 60 * 60 * 24));
            marriageText = `<@${u.marriage.partner}> ile ${days} gündür evli 💍`;
        }

        const embed = new EmbedBuilder()
            .setTitle(`👤 ${target.username} Profil Kartı`)
            .setColor('#F1C40F')
            .addFields(
                { name: '💰 FAM Coin', value: `**${u.balance.toLocaleString()}** FC`, inline: true },
                { name: '⭐ Level', value: `Level **${u.level}** (${u.xp}/100 XP)`, inline: true },
                { name: '💼 Meslek', value: u.job ? JOBS[u.job].name : 'İşsiz', inline: true },
                { name: '💍 Evlilik Durumu', value: marriageText, inline: false },
                { name: '📈 Yatırımlar', value: `Gümüş: ${u.investments.silver} | Altın: ${u.investments.gold} | Elmas: ${u.investments.diamond}`, inline: false }
            )
            .setThumbnail(target.displayAvatarURL());

        return message.reply({ embeds: [embed] });
    }

    // 📈 BORSA VE YATIRIM SİSTEMİ
    if (command === 'borsa') {
        const m = getMarket();
        const embed = new EmbedBuilder()
            .setTitle('📈 FAM Borsa Fiyatları (Canlı)')
            .setColor('#2ECC71')
            .addFields(
                { name: '🥈 Gümüş', value: `${m.silver} FC`, inline: true },
                { name: '🥇 Altın', value: `${m.gold} FC`, inline: true },
                { name: '💎 Elmas', value: `${m.diamond} FC`, inline: true }
            )
            .setFooter({ text: 'Fiyatlar her 5 dakikada bir güncellenir. Alım: !yatirim-al | Satım: !yatirim-sat' });
        return message.reply({ embeds: [embed] });
    }

    if (command === 'yatirim-al') {
        const type = args[0]?.toLowerCase();
        const amount = parseInt(args[1]);
        const m = getMarket();

        if (!['silver', 'gold', 'diamond'].includes(type) || isNaN(amount) || amount <= 0) {
            return message.reply('❌ Kullanım: `!yatirim-al silver/gold/diamond adet`');
        }

        const cost = m[type] * amount;
        const u = getUserData(userId);
        if (u.balance < cost) return message.reply(`❌ Yeterli bakiye yok! Toplam tutar: **${cost} FC**`);

        updateUserData(userId, (data) => {
            data.balance -= cost;
            data.investments[type] += amount;
        });

        return message.reply(`✅ **${amount} adet ${type.toUpperCase()}** alındı! Harcanan: **${cost} FC**`);
    }

    if (command === 'yatirim-sat') {
        const type = args[0]?.toLowerCase();
        const amount = parseInt(args[1]);
        const m = getMarket();

        if (!['silver', 'gold', 'diamond'].includes(type) || isNaN(amount) || amount <= 0) {
            return message.reply('❌ Kullanım: `!yatirim-sat silver/gold/diamond adet`');
        }

        const u = getUserData(userId);
        if (u.investments[type] < amount) return message.reply('❌ Elinizde o kadar yatırım yok!');

        const totalReturn = m[type] * amount;
        updateUserData(userId, (data) => {
            data.investments[type] -= amount;
            data.balance += totalReturn;
        });

        return message.reply(`💰 **${amount} adet ${type.toUpperCase()}** satıldı! Kazanılan: **${totalReturn} FC**`);
    }

    // 🎰 KUMAR: SLOT VE BLACKJACK
    if (command === 'slot') {
        const bet = parseInt(args[0]);
        const u = getUserData(userId);
        if (isNaN(bet) || bet <= 0 || u.balance < bet) return message.reply('❌ Geçerli bir bahis miktarı girin!');

        const symbols = ['🎰', '🎲', '💎', '🍒'];
        const s1 = symbols[Math.floor(Math.random() * symbols.length)];
        const s2 = symbols[Math.floor(Math.random() * symbols.length)];
        const s3 = symbols[Math.floor(Math.random() * symbols.length)];

        if (s1 === s2 && s2 === s3) {
            const win = bet * 3;
            updateUserData(userId, (data) => { data.balance += win; });
            return message.reply(`[ ${s1} | ${s2} | ${s3} ]\n🔥 **BÜYÜK KAZANÇ!** **${win} FAM Coin** hesabına aktarıldı.`);
        } else {
            updateUserData(userId, (data) => { data.balance -= bet; });
            return message.reply(`[ ${s1} | ${s2} | ${s3} ]\n❌ **Kaybettin!** **${bet} FAM Coin** gitti.`);
        }
    }

    if (command === 'bj' || command === 'blackjack') {
        const bet = parseInt(args[0]);
        const u = getUserData(userId);
        if (isNaN(bet) || bet <= 0 || u.balance < bet) return message.reply('❌ Geçerli bir bahis miktarı girin!');

        const playerHand = Math.floor(Math.random() * 7) + 15; // 15-21 arası rastgele skor
        const dealerHand = Math.floor(Math.random() * 7) + 15;

        if (playerHand > 21) {
            updateUserData(userId, (data) => { data.balance -= bet; });
            return message.reply(`🃏 **Masa:** ${dealerHand} | **Sen:** ${playerHand}\n💥 **21'i geçtin, kaybettin!** (-${bet} FC)`);
        } else if (dealerHand > 21 || playerHand > dealerHand) {
            const win = bet * 2;
            updateUserData(userId, (data) => { data.balance += win; });
            return message.reply(`🃏 **Masa:** ${dealerHand} | **Sen:** ${playerHand}\n🎉 **KAZANDIN!** **+${win} FAM Coin** hesaba eklendi!`);
        } else if (playerHand === dealerHand) {
            return message.reply(`🃏 **Masa:** ${dealerHand} | **Sen:** ${playerHand}\n🤝 **Berabere!** Paran iade edildi.`);
        } else {
            updateUserData(userId, (data) => { data.balance -= bet; });
            return message.reply(`🃏 **Masa:** ${dealerHand} | **Sen:** ${playerHand}\n❌ **Masa kazandı!** (-${bet} FC)`);
        }
    }

    // 🎵 MÜZİK KOMUTLARI (ÇAL, DÖNGÜ, GEÇ, DUR)
    if (command === 'çal' || command === 'cal') {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply('❌ Önce bir ses kanalına girmelisin!');

        const url = args[0];
        if (!url || !url.includes('spotify.com/')) {
            return message.reply('❌ Lütfen geçerli bir **Spotify Şarkı veya Playlist Linki** girin.');
        }

        let serverQueue = queues.get(message.guild.id);
        if (!serverQueue) {
            const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
                selfDeaf: true
            });

            serverQueue = { voiceChannel, textChannel: message.channel, connection, player, songs: [], loop: 'kapat', playing: false };
            queues.set(message.guild.id, serverQueue);

            player.on(AudioPlayerStatus.Idle, () => {
                const q = queues.get(message.guild.id);
                if (!q) return;
                if (q.loop === 'şarkı') playSong(message.guild.id);
                else if (q.loop === 'liste') {
                    const finishedSong = q.songs.shift();
                    if (finishedSong) q.songs.push(finishedSong);
                    playSong(message.guild.id);
                } else {
                    q.songs.shift();
                    playSong(message.guild.id);
                }
            });
        }

        if (url.includes('spotify.com/track/')) {
            try {
                const trackId = url.split('track/')[1].split('?')[0];
                const res = await spotifyApi.getTrack(trackId);
                const t = res.body;

                const song = { title: t.name, artist: t.artists.map(a => a.name).join(', '), url: t.external_urls.spotify, thumbnail: t.album.images[0]?.url || null };
                serverQueue.songs.push(song);

                if (!serverQueue.playing) playSong(message.guild.id);
                else message.reply(`➕ **${song.title}** sıraya eklendi!`);
            } catch (e) { return message.reply('❌ Spotify şarkı linki okunamadı!'); }
        } else if (url.includes('spotify.com/playlist/')) {
            try {
                const playlistId = url.split('playlist/')[1].split('?')[0];
                const res = await spotifyApi.getPlaylist(playlistId);
                let count = 0;
                for (const item of res.body.tracks.items) {
                    if (item.track) {
                        serverQueue.songs.push({
                            title: item.track.name,
                            artist: item.track.artists.map(a => a.name).join(', '),
                            url: item.track.external_urls.spotify,
                            thumbnail: item.track.album.images[0]?.url || null
                        });
                        count++;
                    }
                }
                message.reply(`🎧 Playlistten **${count} şarkı** sıraya eklendi!`);
                if (!serverQueue.playing) playSong(message.guild.id);
            } catch (e) { return message.reply('❌ Spotify playlist linki okunamadı!'); }
        }
    }

    if (command === 'dur' || command === 'stop') {
        const serverQueue = queues.get(message.guild.id);
        if (!serverQueue) return message.reply('❌ Çalan bir şey yok!');
        serverQueue.songs = [];
        serverQueue.player.stop();
        serverQueue.playing = false;
        return message.reply('⏹️ Müzik durduruldu ve liste temizlendi.');
    }

    if (command === 'katıl' || command === 'katil') {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply('❌ Önce bir ses kanalına gir!');
        joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator,
            selfDeaf: true
        });
        return message.reply(`🔊 **${voiceChannel.name}** kanalına girildi ve 7/24 aktif tutuluyor!`);
    }

    // YARDIM
    if (command === 'yardım' || command === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setTitle('🤖 Bot Tüm Komut Listesi')
            .setColor('#5865F2')
            .addFields(
                { name: '📋 Sunucu Yönetimi', value: '`!sunucu-kopyala` • Odaları & rolleri kaydeder.\n`!sunucu-yapistir` • Yeni sunucuya kurar.\n`!sunucu-dagit` • Sunucuyu sıfırlar.' },
                { name: '💼 Ekonomi & İş', value: '`!is-sec <sanayi/sahte_ayakkabi/eskort/spotify>`\n`!calis` • 5 dakikada bir para kazandırır (Level zammı uygular).\n`!para-gonder @kullanici miktar`' },
                { name: '💍 Mağaza & Profil', value: '`!magaza` | `!satin-al yuzuk` | `!evlen @kullanici` | `!profil`' },
                { name: '📈 Borsa & Oyunlar', value: '`!borsa` | `!yatirim-al` | `!yatirim-sat`\n`!slot <miktar>` | `!bj <miktar>`' },
                { name: '🎵 Müzik & Ses', value: '`!çal <spotify-link>` | `!dur` | `!katıl`' }
            );
        return message.reply({ embeds: [helpEmbed] });
    }
});

client.login(process.env.TOKEN || process.env.DISCORD_TOKEN);
