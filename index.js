require('dotenv').config();
const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  EmbedBuilder, 
  ChannelType, 
  PermissionFlagsBits 
} = require('discord.js');
const { 
  joinVoiceChannel, 
  getVoiceConnection, 
  createAudioPlayer, 
  createAudioResource, 
  StreamType 
} = require('@discordjs/voice');
const { spawn } = require('child_process');
const http = require('http');

// 🌐 Render Uptime Web Sunucusu
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end("7/24 Spotify & Sunucu Klonlama Botu Aktif!");
}).listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Uptime sunucusu ${PORT} portunda dinleniyor.`);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember]
});

// 💾 Hafızada Tutulan Sunucu Yapısı (Kopyalama için)
let copiedGuildData = null;

// 🟢 LIBRESPOT (SPOTIFY SUNUCU İSTEMCİSİ)
let librespotProcess = null;

function startSpotifyStream() {
    console.log('⚡ Spotify Sunucularına Canlı Bağlantı Başlatılıyor...');
    
    librespotProcess = spawn('librespot', [
        '--name', 'DiscordNativeBot',
        '--username', process.env.SPOTIFY_USER,
        '--password', process.env.SPOTIFY_PASS,
        '--backend', 'pipe',
        '--format', 'S16',
        '--bitrate', '320',
        '--initial-volume', '100',
        '--disable-audio-cache'
    ]);

    librespotProcess.stderr.on('data', (data) => {
        console.log(`[Spotify Engine]: ${data.toString()}`);
    });

    librespotProcess.on('close', (code) => {
        console.log(`⚠️ Spotify motoru kapandı (Kod: ${code}), 3 saniye sonra yeniden başlatılıyor...`);
        setTimeout(startSpotifyStream, 3000);
    });
}

// 📌 7/24 SESE BAĞLANMA FONKSİYONU
function joinAutoVoice() {
    const channelId = process.env.VOICE_CHANNEL_ID;
    if (!channelId) {
        console.log('⚠️ VOICE_CHANNEL_ID girilmediği için otomatik sese girilmedi.');
        return;
    }

    try {
        const channel = client.channels.cache.get(channelId);
        if (channel && channel.isVoiceBased()) {
            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
                selfDeaf: false
            });

            console.log(`📌 7/24 Ses Odasına Katılındı: ${channel.name}`);

            // Kopma veya atılma durumunda 5 sn sonra geri gir
            connection.on('stateChange', (oldState, newState) => {
                if (newState.status === 'disconnected') {
                    console.log('⚠️ Sesten düşüldü, 5 saniye sonra tekrar bağlanılıyor...');
                    setTimeout(joinAutoVoice, 5000);
                }
            });
        }
    } catch (e) {
        console.error('7/24 Sese bağlanma hatası:', e);
    }
}

client.once('ready', () => {
    console.log(`🔥 Bot ${client.user.tag} olarak başarıyla aktifleşti!`);
    
    // 7/24 Odaya Otomatik Katıl
    joinAutoVoice();

    // Spotify Canlı Motorunu Başlat
    if (process.env.SPOTIFY_USER && process.env.SPOTIFY_PASS) {
        startSpotifyStream();
    } else {
        console.warn('⚠️ SPOTIFY_USER ve SPOTIFY_PASS env değişkenleri eksik!');
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const args = message.content.trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // 📖 YARDIM MENÜSÜ
    if (command === '!yardım' || command === '!help') {
        const embed = new EmbedBuilder()
            .setTitle('🤖 Bot Komut Listesi')
            .setColor('#1DB954')
            .addFields(
                {
                    name: '🎵 Spotify Canlı Ses',
                    value: '`!çal` • Şarkı yayınını bu ses kanalına bağlar (Spotify Connect).\n`!ayrıl` • Ses kanalından çıkış yapar.'
                },
                {
                    name: '🎭 Sunucu Kopyalama & Yükleme',
                    value: '`!kopyala` • Bulunduğun sunucunun rol ve kanal yapısını hafızaya alır.\n`!dağıt` / `!yükle` • Kopyalanan yapıyı mevcut sunucuya sıfırdan kurar.'
                }
            )
            .setFooter({ text: '7/24 Aktif Sistem' });

        return message.reply({ embeds: [embed] });
    }

    // 🎵 SPOTIFY MÜZİK KOMUTU
    if (command === '!çal' || command === '!cal') {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply('❌ Önce bir ses kanalına gir kanka!');

        if (!librespotProcess || !librespotProcess.stdout) {
            return message.reply('❌ Spotify motoru henüz hazır değil! Env bilgilerini kontrol et.');
        }

        try {
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
                selfDeaf: false
            });

            const resource = createAudioResource(librespotProcess.stdout, {
                inputType: StreamType.Raw
            });

            const player = createAudioPlayer();
            player.play(resource);
            connection.subscribe(player);

            const embed = new EmbedBuilder()
                .setTitle('🟢 Spotify Canlı Yayını Başlatıldı!')
                .setColor('#1DB954')
                .setDescription(
                    '1. Telefonundan veya PC\'den **Spotify** uygulamasını aç.\n' +
                    '2. Sağ alttaki **Cihazlar (Spotify Connect)** butonuna bas.\n' +
                    '3. **`DiscordNativeBot`** cihazını seç.\n\n' +
                    '🎶 Açtığın her şarkı doğrudan Spotify sunucularından bu kanala akacak!'
                );

            return message.reply({ embeds: [embed] });
        } catch (e) {
            console.error('Sese katılma hatası:', e);
            return message.reply('❌ Sese katılırken bir sorun oluştu!');
        }
    }

    if (command === '!ayrıl' || command === '!ayril') {
        const connection = getVoiceConnection(message.guild.id);
        if (!connection) return message.reply('❌ Şu an bir ses kanalında değilim.');
        connection.destroy();
        return message.reply('👋 Ses kanalından ayrıldım.');
    }

    // 🎭 SUNUCU KOPYALAMA
    if (command === '!kopyala') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Bu komutu sadece **Yönetici** yetkisi olanlar kullanabilir!');
        }

        const msg = await message.reply('🔄 Sunucu yapısı (roller, kategoriler ve kanallar) kopyalanıyor...');

        try {
            const guild = message.guild;

            const roles = guild.roles.cache
                .filter(r => !r.managed && r.name !== '@everyone')
                .sort((a, b) => b.position - a.position)
                .map(r => ({
                    name: r.name,
                    color: r.color,
                    hoist: r.hoist,
                    mentionable: r.mentionable
                }));

            const categories = [];
            const guildCategories = guild.channels.cache
                .filter(c => c.type === ChannelType.GuildCategory)
                .sort((a, b) => a.position - b.position);

            for (const [_, category] of guildCategories) {
                const children = guild.channels.cache
                    .filter(c => c.parentId === category.id)
                    .sort((a, b) => a.position - b.position)
                    .map(c => ({
                        name: c.name,
                        type: c.type,
                        topic: c.topic || null,
                        nsfw: c.nsfw || false,
                        bitrate: c.bitrate || undefined,
                        userLimit: c.userLimit || undefined
                    }));

                categories.push({
                    name: category.name,
                    channels: children
                });
            }

            const orphanChannels = guild.channels.cache
                .filter(c => !c.parentId && c.type !== ChannelType.GuildCategory)
                .map(c => ({
                    name: c.name,
                    type: c.type,
                    topic: c.topic || null,
                    nsfw: c.nsfw || false
                }));

            copiedGuildData = { roles, categories, orphanChannels };

            return msg.edit(`✅ **${guild.name}** yapısı başarıyla kopyalandı!\n📋 **${roles.length} Rol**, **${categories.length} Kategori** kayıt edildi.\n👉 Başka sunucuya geçip **\`!dağıt\`** yazarak kurabilirsin.`);
        } catch (e) {
            console.error('Kopyalama hatası:', e);
            return msg.edit('❌ Sunucu kopyalanırken hata oluştu!');
        }
    }

    // 🎭 SUNUCU DAĞIT / YÜKLE
    if (command === '!dağıt' || command === '!dagit' || command === '!yükle' || command === '!yukle') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Bu komut için **Yönetici** yetkisi şart!');
        }

        if (!copiedGuildData) {
            return message.reply('❌ Kopyalanmış sunucu verisi bulunamadı! Önce **\`!kopyala\`** çalıştır kanka.');
        }

        await message.reply('⚠️ **Kurulum Başlıyor!** Kanallar silinip yeni düzen kurulacak...');

        try {
            const guild = message.guild;

            // 1. Kanalları Temizle
            const currentChannels = Array.from(guild.channels.cache.values());
            for (const ch of currentChannels) {
                try { await ch.delete(); } catch (e) {}
            }

            // 2. Rolleri Oluştur
            for (const roleData of copiedGuildData.roles) {
                try {
                    await guild.roles.create({
                        name: roleData.name,
                        color: roleData.color,
                        hoist: roleData.hoist,
                        mentionable: roleData.mentionable
                    });
                } catch (e) {}
            }

            // 3. Kategoriler & İç Kanallar
            for (const catData of copiedGuildData.categories) {
                const category = await guild.channels.create({
                    name: catData.name,
                    type: ChannelType.GuildCategory
                });

                for (const chData of catData.channels) {
                    await guild.channels.create({
                        name: chData.name,
                        type: chData.type,
                        topic: chData.topic,
                        nsfw: chData.nsfw,
                        bitrate: chData.bitrate,
                        userLimit: chData.userLimit,
                        parent: category.id
                    });
                }
            }

            // 4. Başıboş Kanallar
            for (const orphan of copiedGuildData.orphanChannels) {
                await guild.channels.create({
                    name: orphan.name,
                    type: orphan.type,
                    topic: orphan.topic,
                    nsfw: orphan.nsfw
                });
            }

            const textChannel = guild.channels.cache.find(c => c.type === ChannelType.GuildText);
            if (textChannel) {
                textChannel.send('🎉 **Sunucu yapısı başarıyla kopyalanıp dağıtıldı!**');
            }
        } catch (e) {
            console.error('Dağıtma hatası:', e);
        }
    }
});

client.login(process.env.TOKEN);
