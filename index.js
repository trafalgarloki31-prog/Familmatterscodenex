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
const SpotifyWebApi = require('spotify-web-api-node');
const play = require('play-dl');

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

// Render Uptime
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

// -------------------------------------------------------------
// 💾 SES OYNATICI VE SIRA (QUEUE) SİSTEMİ
// -------------------------------------------------------------
const queues = new Map();

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

// -------------------------------------------------------------
// 💾 EKONOMİ VERİTABANI
// -------------------------------------------------------------
const db = { users: {} };

function getUser(userId) {
    if (!db.users[userId]) {
        db.users[userId] = {
            balance: 1000, job: 'Sanayi', level: 1, xp: 0,
            marriedTo: null, ring: null, inventory: [], lastDaily: 0, lastMonthly: 0
        };
    }
    return db.users[userId];
}

const JOBS = {
    'sanayi': { name: 'Sanayi', minLevel: 1, daily: 500, monthly: 5000 },
    'sahte ayakkabı': { name: 'Sahte Ayakkabıcı', minLevel: 10, daily: 1500, monthly: 15000 },
    'eskort': { name: 'Eskort', minLevel: 20, daily: 3500, monthly: 35000 },
    'yazılımcı': { name: 'Yazılımcı', minLevel: 30, daily: 7500, monthly: 75000 }
};

const RINGS = {
    'tahta': { name: 'Tahta Yüzük', price: 500, emoji: '🥉' },
    'gümüş': { name: 'Gümüş Yüzük', price: 2500, emoji: '🥈' },
    'pırlanta': { name: 'Pırlanta Yüzük', price: 10000, emoji: '💍' },
    'kral': { name: 'Kral Yüzüğü', price: 50000, emoji: '👑' }
};

const tempChannels = new Set();
const userMessageMap = new Map();
let copiedGuildData = null;

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

    // Oto Spam
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

    // XP
    const userData = getUser(message.author.id);
    userData.xp += Math.floor(Math.random() * 10) + 5;
    if (userData.xp >= userData.level * 100) {
        userData.level += 1;
        userData.xp = 0;
        message.channel.send(`🎉 Tebrikler <@${message.author.id}>! **Level ${userData.level}** oldun!`).catch(() => {});
    }

    const lowerText = message.content.toLowerCase().trim();
    if (['sa', 'sea', 'selam', 'selamunaleykum', 'selamın aleyküm'].includes(lowerText)) {
        return message.reply(`Aleykümselam **${message.author.username}**, hoş geldin! 👋`);
    }

    const args = message.content.trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // YARDIM
    if (command === '!yardım' || command === '!help') {
        const helpEmbed = new EmbedBuilder()
            .setTitle('🤖 Bot Komut Listesi')
            .setColor('#5865F2')
            .addFields(
                { 
                    name: '🎵 Müzik & Spotify Komutları', 
                    value: '`!çal <spotify linki>` • Şarkı veya Playlist linki ile müzik çalar.\n`!döngü <şarkı/liste/kapat>` • Şarkıyı veya listeyi tekrara alır.\n`!geç` • Sıradaki şarkıya geçer.\n`!dur` • Müziği durdurur ve sırayı temizler.' 
                },
                { 
                    name: '🎙️ Ses Komutları', 
                    value: '`!katıl` • Bulunduğun ses kanalına girer ve 7/24 kalır.\n`!ayrıl` • Ses kanalından çıkar.' 
                },
                { 
                    name: '💼 Ekonomi & Evlilik', 
                    value: '`!profil` • Profilini gösterir.\n`!işler` • Meslekler.\n`!günlük` • Günlük harçlık.\n`!evlen` / `!boşan` • Evlilik.' 
                }
            )
            .setFooter({ text: 'FAM • Sistem rehberi' });

        return message.reply({ embeds: [helpEmbed] });
    }

    // 🎵 MÜZİK KOMUTLARI
    if (command === '!çal' || command === '!cal') {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply('❌ Önce bir ses kanalına girmelisin kanka!');

        const url = args[0];
        if (!url || !url.includes('spotify.com/')) {
            return message.reply('❌ **Rastgele aramalar engellendi!** Lütfen geçerli bir **Spotify Şarkı veya Playlist Linki** yapıştır kanka.');
        }

        let serverQueue = queues.get(message.guild.id);
        if (!serverQueue) {
            const player = createAudioPlayer({
                behaviors: {
                    noSubscriber: NoSubscriberBehavior.Play // Yalnızken bile çalmaya ve dönmeye devam eder
                }
            });

            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
                selfDeaf: true
            });

            serverQueue = {
                voiceChannel: voiceChannel,
                textChannel: message.channel,
                connection: connection,
                player: player,
                songs: [],
                loop: 'kapat',
                playing: false
            };

            queues.set(message.guild.id, serverQueue);

            player.on(AudioPlayerStatus.Idle, () => {
                const q = queues.get(message.guild.id);
                if (!q) return;

                if (q.loop === 'şarkı') {
                    playSong(message.guild.id);
                } else if (q.loop === 'liste') {
                    const finishedSong = q.songs.shift();
                    if (finishedSong) q.songs.push(finishedSong);
                    playSong(message.guild.id);
                } else {
                    q.songs.shift();
                    playSong(message.guild.id);
                }
            });
        }

        // 1. TEKİL ŞARKI LİNKİ
        if (url.includes('spotify.com/track/')) {
            try {
                const trackId = url.split('track/')[1].split('?')[0];
                const res = await spotifyApi.getTrack(trackId);
                const t = res.body;

                const song = {
                    title: t.name,
                    artist: t.artists.map(a => a.name).join(', '),
                    url: t.external_urls.spotify,
                    thumbnail: t.album.images[0]?.url || null
                };

                serverQueue.songs.push(song);
                if (!serverQueue.playing) {
                    playSong(message.guild.id);
                    return message.reply(`🎵 **${song.title}** çalınmaya başlandı!`);
                } else {
                    return message.reply(`➕ **${song.title}** sıraya eklendi!`);
                }
            } catch (e) {
                return message.reply('❌ Spotify şarkı linki okunamadı!');
            }
        } 
        // 2. PLAYLIST LİNKİ
        else if (url.includes('spotify.com/playlist/')) {
            try {
                const playlistId = url.split('playlist/')[1].split('?')[0];
                const res = await spotifyApi.getPlaylist(playlistId);
                const playlist = res.body;

                const tracks = playlist.tracks.items;
                let count = 0;

                for (const item of tracks) {
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

                message.reply(`🎧 **${playlist.name}** listesinden **${count} şarkı** eklendi!`);

                if (!serverQueue.playing) {
                    playSong(message.guild.id);
                }
            } catch (e) {
                return message.reply('❌ Spotify playlist linki okunamadı! Listenin herkese açık olduğundan emin ol.');
            }
        }
    }

    // 🔁 DÖNGÜ / LOOP KOMUTU
    if (command === '!döngü' || command === '!dongu' || command === '!loop') {
        const serverQueue = queues.get(message.guild.id);
        if (!serverQueue) return message.reply('❌ Şu an çalan bir müzik yok kanka!');

        const mode = args[0]?.toLowerCase();
        if (!mode || !['şarkı', 'sarki', 'liste', 'kapat'].includes(mode)) {
            return message.reply('❌ Doğru Kullanım: `!döngü şarkı` | `!döngü liste` | `!döngü kapat`');
        }

        if (mode === 'şarkı' || mode === 'sarki') {
            serverQueue.loop = 'şarkı';
            return message.reply('🔂 **Şarkı Döngüsü Açıldı!** (Aynı şarkı sürekli dönecek)');
        } else if (mode === 'liste') {
            serverQueue.loop = 'liste';
            return message.reply('🔁 **Liste Döngüsü Açıldı!** (Liste bittiğinde baştan başlayacak)');
        } else if (mode === 'kapat') {
            serverQueue.loop = 'kapat';
            return message.reply('➡️ **Döngü Kapatıldı!**');
        }
    }

    // ⏭️ GEÇ KOMUTU
    if (command === '!geç' || command === '!gec' || command === '!skip') {
        const serverQueue = queues.get(message.guild.id);
        if (!serverQueue || !serverQueue.playing) return message.reply('❌ Çalan bir şey yok kanka!');
        serverQueue.songs.shift();
        playSong(message.guild.id);
        return message.reply('⏭️ Şarkı atlandı!');
    }

    // ⏹️ DUR KOMUTU
    if (command === '!dur' || command === '!stop') {
        const serverQueue = queues.get(message.guild.id);
        if (!serverQueue) return message.reply('❌ Çalan bir şey yok kanka!');
        serverQueue.songs = [];
        serverQueue.player.stop();
        serverQueue.playing = false;
        return message.reply('⏹️ Müzik durduruldu ve liste temizlendi.');
    }

    // 🎙️ SES & KATIL/AYRIL
    if (command === '!katıl' || command === '!katil' || command === '!join') {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply('❌ Önce bir ses kanalına girmelisin!');
        try {
            joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
                selfDeaf: true
            });
            return message.reply(`🔊 **${voiceChannel.name}** kanalına girildi!`);
        } catch (e) { return message.reply('❌ Sese katılırken hata!'); }
    }

    if (command === '!ayrıl' || command === '!ayril') {
        const connection = getVoiceConnection(message.guild.id);
        if (!connection) return message.reply('❌ Seste değilim!');
        connection.destroy();
        queues.delete(message.guild.id);
        return message.reply('👋 Ses kanalından ayrıldım.');
    }

    // 💼 EKONOMİ KOMUTLARI
    if (command === '!profil' || command === '!bakiye') {
        const targetUser = message.mentions.users.first() || message.author;
        const u = getUser(targetUser.id);
        const profileEmbed = new EmbedBuilder()
            .setTitle(`👤 ${targetUser.username} Profil Kartı`)
            .setColor('#F1C40F')
            .addFields(
                { name: '💰 Fam Coin', value: `**${u.balance.toLocaleString()}** FC`, inline: true },
                { name: '💼 Meslek', value: `${u.job}`, inline: true },
                { name: '⭐ Level', value: `Level **${u.level}**`, inline: true }
            );
        return message.reply({ embeds: [profileEmbed] });
    }

    if (command === '!günlük' || command === '!gunluk') {
        const now = Date.now();
        if (now - userData.lastDaily < 86400000) return message.reply('⏳ Günlük maaşını zaten aldın!');
        userData.balance += 500;
        userData.lastDaily = now;
        return message.reply('💵 **500 FC** günlük maaşını aldın!');
    }
});

client.login(process.env.TOKEN).catch(err => {
    console.error("❌ TOKEN HATASI:", err);
});
