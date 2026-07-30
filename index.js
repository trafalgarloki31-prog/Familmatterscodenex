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
  VoiceConnectionStatus,
  entersState
} = require('@discordjs/voice');
const http = require('http');

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
// 💾 EKONOMİ VERİTABANI
// -------------------------------------------------------------
const db = { users: {} };

const WORK_COOLDOWN = 5 * 60 * 1000; // 5 dakika

function getUser(userId) {
    if (!db.users[userId]) {
        db.users[userId] = {
            balance: 1000,
            job: null,
            level: 1,
            xp: 0,
            marriedTo: null,
            marriedSince: null,
            ring: null,
            inventory: { altin: 0, gumus: 0, elmas: 0 },
            lastWork: 0
        };
    }
    return db.users[userId];
}

// İş listesi (sıralama = maaş sıralaması)
const JOBS = {
    'sanayi': { name: 'Sanayi İşçisi', minLevel: 1, basePay: 200 },
    'sahte ayakkabıcı': { name: 'Sahte Ayakkabıcı', minLevel: 5, basePay: 450 },
    'eskort': { name: 'Eskort', minLevel: 10, basePay: 800 },
    'spotify sanatçısı': { name: 'Spotify Sanatçısı', minLevel: 20, basePay: 1500 }
};

// Yüzükler
const RINGS = {
    'tahta': { name: 'Tahta Yüzük', price: 500, emoji: '🥉' },
    'gümüş': { name: 'Gümüş Yüzük', price: 2500, emoji: '🥈' },
    'pırlanta': { name: 'Pırlanta Yüzük', price: 10000, emoji: '💍' },
    'kral': { name: 'Kral Yüzüğü', price: 50000, emoji: '👑' }
};

// Yatırım / Borsa sistemi
const MARKET = {
    altin: { name: 'Altın', emoji: '🥇', price: 2000 },
    gumus: { name: 'Gümüş', emoji: '🥈', price: 500 },
    elmas: { name: 'Elmas', emoji: '💎', price: 5000 }
};

function updateMarket() {
    for (const key in MARKET) {
        const changePercent = (Math.random() * 10 - 5) / 100; // -%5 ile +%5 arası
        MARKET[key].price = Math.max(10, Math.round(MARKET[key].price * (1 + changePercent)));
    }
}
setInterval(updateMarket, 5 * 60 * 1000); // Fiyatlar her 5 dakikada bir güncellenir

// Level atlama flört metinleri
const LEVEL_UP_MESSAGES = [
    'Aa bir de seviye atlamışsın, resmen içimi ısıtıyorsun 😏',
    'Her geçen gün daha da etkileyici oluyorsun, biliyor musun? 😍',
    'Seviye atladın ama asıl sen benim seviyemi attırdın 💘',
    'Böyle gelişmene bayılıyorum, devam et böyle 😘',
    'Sen büyüdükçe ben de sana daha çok hayran kalıyorum 🥰',
    'Yeni seviyen çok yakışmış sana, tıpkı her şey gibi 😉',
    'Bu ilerleme resmen kalp çaldırıyor 💓',
    'Sana bakıp bakıp seviye atladığını görmek çok tatlı 😌',
    'Böyle gidersen yakında beni de fethedeceksin 😅💕',
    'Seviye atladın, tebrikler! Ama gönlümü çoktan fethetmiştin zaten 💞'
];

const tempChannels = new Set();
const userMessageMap = new Map();
let copiedGuildData = null;

// -------------------------------------------------------------
// 🔊 7/24 SESTE KALMA SİSTEMİ
// -------------------------------------------------------------
const persistentVoiceChannels = new Map(); // guildId -> channelId

function sesKanalinaBaglan(guild, channelId) {
    const connection = joinVoiceChannel({
        channelId: channelId,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: true,
        selfMute: true
    });

    persistentVoiceChannels.set(guild.id, channelId);

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
            // Geçici bir kopma mı (kanal değişimi vb.) yoksa gerçek kopma mı, ayırt et
            await Promise.race([
                entersState(connection, VoiceConnectionStatus.Signalling, 5000),
                entersState(connection, VoiceConnectionStatus.Connecting, 5000)
            ]);
        } catch (error) {
            const kayitliKanal = persistentVoiceChannels.get(guild.id);
            if (kayitliKanal) {
                connection.destroy();
                setTimeout(() => sesKanalinaBaglan(guild, kayitliKanal), 3000);
            }
        }
    });

    connection.on(VoiceConnectionStatus.Destroyed, () => {
        const kayitliKanal = persistentVoiceChannels.get(guild.id);
        if (kayitliKanal) {
            setTimeout(() => sesKanalinaBaglan(guild, kayitliKanal), 3000);
        }
    });

    return connection;
}

client.once('ready', () => {
  console.log(`🤖 Bot ${client.user.tag} olarak başarıyla aktifleşti!`);
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

    // Oto Spam Engeli
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

    // ⭐ XP & LEVEL SİSTEMİ
    const userData = getUser(message.author.id);
    userData.xp += 10; // her mesaj 10 xp
    if (userData.xp >= 100) {
        userData.xp -= 100;
        userData.level += 1;
        const randomMsg = LEVEL_UP_MESSAGES[Math.floor(Math.random() * LEVEL_UP_MESSAGES.length)];
        message.channel.send(`🎉 Tebrikler <@${message.author.id}>! **Level ${userData.level}** oldun!\n${randomMsg}`).catch(() => {});
    }

    const lowerText = message.content.toLowerCase().trim();
    if (['sa', 'sea', 'selam', 'selamunaleykum', 'selamın aleyküm'].includes(lowerText)) {
        return message.reply(`Aleykümselam **${message.author.username}**, hoş geldin! 👋`);
    }

    const args = message.content.trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // 📖 YARDIM
    if (command === '!yardım' || command === '!help') {
        const helpEmbed = new EmbedBuilder()
            .setTitle('🤖 Bot Komut Listesi')
            .setColor('#5865F2')
            .addFields(
                {
                    name: '🏰 Sunucu Yönetimi',
                    value: '`!sunucu kopyala` • Rolleri ve odaları kopyalar.\n`!sunucu yapıştır` • Kopyalananları bu sunucuya aktarır.\n`!sunucu dağıt` • Tüm odaları siler ve herkesi atar.'
                },
                {
                    name: '💼 Ekonomi',
                    value: '`!profil [@kişi]` • Profili gösterir.\n`!işler` • İş listesi.\n`!iş seç <isim>` • Bir iş seçer.\n`!çalış` • Çalışıp para kazanırsın (5 dk cooldown).\n`!gönder @kişi <miktar>` • Para gönderir.'
                },
                {
                    name: '📈 Borsa',
                    value: '`!borsa` • Güncel fiyatları gösterir.\n`!yatırım al <altın/gümüş/elmas> <miktar>` • Yatırım yapar.\n`!yatırım sat <altın/gümüş/elmas> <miktar>` • Satış yapar.'
                },
                {
                    name: '💍 Evlilik',
                    value: '`!yüzükler` • Yüzük mağazası.\n`!yüzük al <tür>` • Yüzük satın alır.\n`!evlen @kişi` • Evlenme teklifi eder.\n`!boşan` • Boşanır.'
                },
                {
                    name: '🎰 Oyunlar',
                    value: '`!blackjack <bahis>` • Blackjack oynar.\n`!slot <bahis>` • Slot çevirir.'
                }
            )
            .setFooter({ text: 'FAM • Sistem rehberi' });

        return message.reply({ embeds: [helpEmbed] });
    }

    // =========================================================
    // 🏰 SUNUCU YÖNETİMİ
    // =========================================================
    if (command === '!sunucu') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Bu komutu kullanmak için yönetici olman gerekiyor!');
        }

        const sub = args[0]?.toLowerCase();

        if (sub === 'kopyala') {
            try {
                const guild = message.guild;
                const roles = guild.roles.cache
                    .filter(r => r.id !== guild.id)
                    .map(r => ({
                        name: r.name,
                        color: r.color,
                        permissions: r.permissions.bitfield.toString(),
                        hoist: r.hoist,
                        mentionable: r.mentionable
                    }));

                const categories = guild.channels.cache
                    .filter(c => c.type === ChannelType.GuildCategory)
                    .map(cat => ({
                        name: cat.name,
                        children: guild.channels.cache
                            .filter(c => c.parentId === cat.id)
                            .map(c => ({ name: c.name, type: c.type }))
                    }));

                const noCategory = guild.channels.cache
                    .filter(c => !c.parentId && c.type !== ChannelType.GuildCategory)
                    .map(c => ({ name: c.name, type: c.type }));

                copiedGuildData = {
                    guildName: guild.name,
                    roles,
                    categories,
                    noCategory,
                    copiedAt: Date.now()
                };

                return message.reply(`✅ **${guild.name}** sunucusunun rolleri ve odaları kopyalandı! (${roles.length} rol, ${categories.length} kategori)`);
            } catch (err) {
                console.error(err);
                return message.reply('❌ Kopyalama sırasında bir hata oluştu!');
            }
        }

        if (sub === 'yapıştır' || sub === 'yapistir') {
            if (!copiedGuildData) return message.reply('❌ Önce `!sunucu kopyala` ile bir sunucu kopyalamalısın!');

            try {
                const guild = message.guild;
                await message.reply(`⏳ **${copiedGuildData.guildName}** sunucusu bu sunucuya aktarılıyor, biraz zaman alabilir...`);

                for (const role of copiedGuildData.roles) {
                    await guild.roles.create({
                        name: role.name,
                        color: role.color,
                        hoist: role.hoist,
                        mentionable: role.mentionable,
                        permissions: BigInt(role.permissions)
                    }).catch(() => {});
                }

                for (const cat of copiedGuildData.categories) {
                    const createdCat = await guild.channels.create({
                        name: cat.name,
                        type: ChannelType.GuildCategory
                    }).catch(() => null);

                    if (createdCat) {
                        for (const ch of cat.children) {
                            await guild.channels.create({
                                name: ch.name,
                                type: ch.type,
                                parent: createdCat.id
                            }).catch(() => {});
                        }
                    }
                }

                for (const ch of copiedGuildData.noCategory) {
                    await guild.channels.create({
                        name: ch.name,
                        type: ch.type
                    }).catch(() => {});
                }

                return message.channel.send('✅ Sunucu yapısı başarıyla aktarıldı!');
            } catch (err) {
                console.error(err);
                return message.channel.send('❌ Yapıştırma sırasında bir hata oluştu!');
            }
        }

        if (sub === 'dağıt' || sub === 'dagit') {
            try {
                const guild = message.guild;
                await message.reply('💥 Sunucu dağıtılıyor...');

                const channels = guild.channels.cache;
                for (const [, ch] of channels) {
                    await ch.delete().catch(() => {});
                }

                const members = await guild.members.fetch();
                for (const [, member] of members) {
                    if (member.id === guild.ownerId || member.id === client.user.id) continue;
                    if (member.kickable) await member.kick('Sunucu dağıtıldı').catch(() => {});
                }
            } catch (err) {
                console.error(err);
            }
            return;
        }

        return message.reply('❌ Doğru kullanım: `!sunucu kopyala` | `!sunucu yapıştır` | `!sunucu dağıt`');
    }

    // =========================================================
    // 🔊 SES KOMUTLARI (7/24 KALICI BAĞLANTI)
    // =========================================================
    if (command === '!katıl' || command === '!katil' || command === '!join') {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply('❌ Önce bir ses kanalına girmelisin!');

        try {
            sesKanalinaBaglan(message.guild, voiceChannel.id);
            return message.reply(`🔊 **${voiceChannel.name}** kanalına girildi! Artık 7/24 bu kanalda kalacağım, biri beni atsa veya bağlantı kopsa bile otomatik geri döneceğim.`);
        } catch (e) {
            console.error(e);
            return message.reply('❌ Sese katılırken hata oluştu!');
        }
    }

    if (command === '!ayrıl' || command === '!ayril' || command === '!leave') {
        const connection = getVoiceConnection(message.guild.id);
        if (!connection) return message.reply('❌ Zaten seste değilim!');

        persistentVoiceChannels.delete(message.guild.id); // önce kaydı sil, yoksa otomatik geri bağlanır
        connection.destroy();
        return message.reply('👋 Ses kanalından ayrıldım.');
    }

    // =========================================================
    // 💼 EKONOMİ KOMUTLARI
    // =========================================================
    if (command === '!profil' || command === '!bakiye') {
        const targetUser = message.mentions.users.first() || message.author;
        const u = getUser(targetUser.id);

        let evlilikBilgisi = 'Bekar 💔';
        if (u.marriedTo) {
            const gunSayisi = Math.floor((Date.now() - u.marriedSince) / (1000 * 60 * 60 * 24));
            evlilikBilgisi = `<@${u.marriedTo}> ile evli 💍 (${gunSayisi} gündür)`;
        }

        const profileEmbed = new EmbedBuilder()
            .setTitle(`👤 ${targetUser.username} Profil Kartı`)
            .setColor('#F1C40F')
            .addFields(
                { name: '💰 Fam Coin', value: `**${u.balance.toLocaleString()}** FC`, inline: true },
                { name: '💼 Meslek', value: `${u.job ? JOBS[u.job].name : 'İşsiz'}`, inline: true },
                { name: '⭐ Level', value: `Level **${u.level}**`, inline: true },
                { name: '💞 Evlilik Durumu', value: evlilikBilgisi, inline: false },
                { name: '📈 Yatırımlar', value: `🥇 Altın: ${u.inventory.altin}\n🥈 Gümüş: ${u.inventory.gumus}\n💎 Elmas: ${u.inventory.elmas}`, inline: false }
            );
        return message.reply({ embeds: [profileEmbed] });
    }

    if (command === '!işler' || command === '!isler') {
        const jobEmbed = new EmbedBuilder()
            .setTitle('💼 Mevcut İşler')
            .setColor('#3498DB')
            .setDescription(Object.entries(JOBS).map(([key, job]) =>
                `**${job.name}** • Min. Level: ${job.minLevel} • Taban Maaş: ${job.basePay} FC\nSeçmek için: \`!iş seç ${key}\``
            ).join('\n\n'));
        return message.reply({ embeds: [jobEmbed] });
    }

    if (command === '!iş' || command === '!is') {
        if (args[0]?.toLowerCase() !== 'seç' && args[0]?.toLowerCase() !== 'sec') {
            return message.reply('❌ Doğru kullanım: `!iş seç <iş adı>`');
        }
        const jobName = args.slice(1).join(' ').toLowerCase();
        const job = JOBS[jobName];
        if (!job) return message.reply('❌ Böyle bir iş yok! `!işler` ile listeyi görebilirsin.');
        if (userData.level < job.minLevel) return message.reply(`❌ Bu iş için en az **Level ${job.minLevel}** olmalısın!`);

        userData.job = jobName;
        return message.reply(`✅ **${job.name}** işine başladın!`);
    }

    if (command === '!çalış' || command === '!calis') {
        if (!userData.job) return message.reply('❌ Önce bir iş seçmelisin! `!işler` yazarak bakabilirsin.');

        const now = Date.now();
        const remaining = WORK_COOLDOWN - (now - userData.lastWork);
        if (remaining > 0) {
            const dakika = Math.ceil(remaining / 60000);
            return message.reply(`⏳ Yorgunsun, dinlenmen lazım! **${dakika} dakika** sonra tekrar çalışabilirsin.`);
        }

        const job = JOBS[userData.job];
        const zam = Math.pow(1.03, userData.level - 1); // her leveldе %3 zam
        const kazanc = Math.round(job.basePay * zam);

        userData.balance += kazanc;
        userData.lastWork = now;

        return message.reply(`💼 **${job.name}** olarak çalıştın ve **${kazanc.toLocaleString()} FC** kazandın!`);
    }

    if (command === '!gönder' || command === '!gonder') {
        const target = message.mentions.users.first();
        const miktar = parseInt(args[1]);

        if (!target) return message.reply('❌ Doğru kullanım: `!gönder @kişi <miktar>`');
        if (target.id === message.author.id) return message.reply('❌ Kendine para gönderemezsin!');
        if (!miktar || miktar <= 0) return message.reply('❌ Geçerli bir miktar gir!');
        if (userData.balance < miktar) return message.reply('❌ Yeterli bakiyen yok!');

        const targetData = getUser(target.id);
        userData.balance -= miktar;
        targetData.balance += miktar;

        return message.reply(`✅ <@${target.id}> kişisine **${miktar.toLocaleString()} FC** gönderdin!`);
    }

    // =========================================================
    // 📈 BORSA / YATIRIM
    // =========================================================
    if (command === '!borsa') {
        const marketEmbed = new EmbedBuilder()
            .setTitle('📈 FAM Borsası')
            .setColor('#2ECC71')
            .setDescription(Object.values(MARKET).map(m => `${m.emoji} **${m.name}**: ${m.price.toLocaleString()} FC`).join('\n'))
            .setFooter({ text: 'Fiyatlar her 5 dakikada bir güncellenir.' });
        return message.reply({ embeds: [marketEmbed] });
    }

    if (command === '!yatırım' || command === '!yatirim') {
        const action = args[0]?.toLowerCase();
        const itemKey = args[1]?.toLowerCase();
        const miktar = parseInt(args[2]);

        const itemMap = { 'altın': 'altin', 'altin': 'altin', 'gümüş': 'gumus', 'gumus': 'gumus', 'elmas': 'elmas' };
        const item = itemMap[itemKey];

        if (!['al', 'sat'].includes(action) || !item || !miktar || miktar <= 0) {
            return message.reply('❌ Doğru kullanım: `!yatırım al/sat <altın/gümüş/elmas> <miktar>`');
        }

        const price = MARKET[item].price;
        const totalCost = price * miktar;

        if (action === 'al') {
            if (userData.balance < totalCost) return message.reply('❌ Yeterli bakiyen yok!');
            userData.balance -= totalCost;
            userData.inventory[item] += miktar;
            return message.reply(`✅ **${miktar} ${MARKET[item].name}** aldın! (**${totalCost.toLocaleString()} FC** ödendi)`);
        } else {
            if (userData.inventory[item] < miktar) return message.reply('❌ Yeterli miktarda yatırımın yok!');
            userData.inventory[item] -= miktar;
            userData.balance += totalCost;
            return message.reply(`✅ **${miktar} ${MARKET[item].name}** sattın! (**${totalCost.toLocaleString()} FC** kazandın)`);
        }
    }

    // =========================================================
    // 💍 EVLİLİK
    // =========================================================
    if (command === '!yüzükler' || command === '!yuzukler') {
        const ringEmbed = new EmbedBuilder()
            .setTitle('💍 Yüzük Mağazası')
            .setColor('#E91E63')
            .setDescription(Object.entries(RINGS).map(([key, ring]) =>
                `${ring.emoji} **${ring.name}** • ${ring.price.toLocaleString()} FC\nSatın almak için: \`!yüzük al ${key}\``
            ).join('\n\n'));
        return message.reply({ embeds: [ringEmbed] });
    }

    if (command === '!yüzük' || command === '!yuzuk') {
        if (args[0]?.toLowerCase() !== 'al') return message.reply('❌ Doğru kullanım: `!yüzük al <tür>`');
        const ringKey = args[1]?.toLowerCase();
        const ring = RINGS[ringKey];
        if (!ring) return message.reply('❌ Böyle bir yüzük yok! `!yüzükler` ile mağazaya bakabilirsin.');
        if (userData.balance < ring.price) return message.reply('❌ Yeterli bakiyen yok!');

        userData.balance -= ring.price;
        userData.ring = ringKey;
        return message.reply(`✅ ${ring.emoji} **${ring.name}** satın aldın! Artık evlenmeye hazırsın.`);
    }

    if (command === '!evlen') {
        const target = message.mentions.users.first();
        if (!target) return message.reply('❌ Doğru kullanım: `!evlen @kişi`');
        if (target.id === message.author.id) return message.reply('❌ Kendinle evlenemezsin!');
        if (!userData.ring) return message.reply('❌ Önce bir yüzük almalısın! `!yüzükler` yazabilirsin.');
        if (userData.marriedTo) return message.reply('❌ Zaten evlisin! Önce boşanmalısın.');

        const targetData = getUser(target.id);
        if (targetData.marriedTo) return message.reply('❌ Bu kişi zaten evli!');

        const now = Date.now();
        userData.marriedTo = target.id;
        userData.marriedSince = now;
        targetData.marriedTo = message.author.id;
        targetData.marriedSince = now;

        const ring = RINGS[userData.ring];
        return message.reply(`💍 ${ring.emoji} <@${message.author.id}> ve <@${target.id}> artık evli! Nice mutlu yıllara! 🎉`);
    }

    if (command === '!boşan' || command === '!bosan') {
        if (!userData.marriedTo) return message.reply('❌ Zaten bekarsın!');
        const exId = userData.marriedTo;
        const exData = getUser(exId);

        userData.marriedTo = null;
        userData.marriedSince = null;
        exData.marriedTo = null;
        exData.marriedSince = null;

        return message.reply(`💔 <@${message.author.id}> ve <@${exId}> artık boşandı.`);
    }

    // =========================================================
    // 🎰 OYUNLAR
    // =========================================================
    if (command === '!slot') {
        const bahis = parseInt(args[0]);
        if (!bahis || bahis <= 0) return message.reply('❌ Doğru kullanım: `!slot <bahis miktarı>`');
        if (userData.balance < bahis) return message.reply('❌ Yeterli bakiyen yok!');

        const symbols = ['🍒', '🍋', '🍇', '💎', '⭐', '7️⃣'];
        const spin = [
            symbols[Math.floor(Math.random() * symbols.length)],
            symbols[Math.floor(Math.random() * symbols.length)],
            symbols[Math.floor(Math.random() * symbols.length)]
        ];

        userData.balance -= bahis;
        let kazanc = 0;

        if (spin[0] === spin[1] && spin[1] === spin[2]) {
            kazanc = spin[0] === '7️⃣' ? bahis * 10 : bahis * 5;
        } else if (spin[0] === spin[1] || spin[1] === spin[2] || spin[0] === spin[2]) {
            kazanc = Math.round(bahis * 1.5);
        }

        userData.balance += kazanc;

        const sonuc = kazanc > 0
            ? `🎉 **${kazanc.toLocaleString()} FC** kazandın!`
            : `😢 Kaybettin! (-${bahis.toLocaleString()} FC)`;

        return message.reply(`🎰 | ${spin.join(' | ')} | 🎰\n${sonuc}`);
    }

    if (command === '!blackjack' || command === '!bj') {
        const bahis = parseInt(args[0]);
        if (!bahis || bahis <= 0) return message.reply('❌ Doğru kullanım: `!blackjack <bahis miktarı>`');
        if (userData.balance < bahis) return message.reply('❌ Yeterli bakiyen yok!');

        const cekKart = () => Math.floor(Math.random() * 10) + 1;

        let playerHand = [cekKart(), cekKart()];
        let dealerHand = [cekKart(), cekKart()];

        let playerTotal = playerHand.reduce((a, b) => a + b, 0);
        let dealerTotal = dealerHand.reduce((a, b) => a + b, 0);

        while (playerTotal < 17) {
            const kart = cekKart();
            playerHand.push(kart);
            playerTotal += kart;
        }

        if (playerTotal <= 21) {
            while (dealerTotal < 17) {
                const kart = cekKart();
                dealerHand.push(kart);
                dealerTotal += kart;
            }
        }

        userData.balance -= bahis;
        let sonucMetni = '';
        let kazanc = 0;

        if (playerTotal > 21) {
            sonucMetni = `💥 Battın! Toplam: ${playerTotal}`;
        } else if (dealerTotal > 21) {
            kazanc = bahis * 2;
            sonucMetni = `🎉 Kazandın! Krupiye battı! (${dealerTotal})`;
        } else if (playerTotal > dealerTotal) {
            kazanc = bahis * 2;
            sonucMetni = `🎉 Kazandın! ${playerTotal} - ${dealerTotal}`;
        } else if (playerTotal === dealerTotal) {
            kazanc = bahis;
            sonucMetni = `🤝 Berabere! Bahsin iade edildi. ${playerTotal} - ${dealerTotal}`;
        } else {
            sonucMetni = `😢 Kaybettin! ${playerTotal} - ${dealerTotal}`;
        }

        userData.balance += kazanc;

        const bjEmbed = new EmbedBuilder()
            .setTitle('🃏 Blackjack')
            .setColor(kazanc > 0 ? '#2ECC71' : '#E74C3C')
            .addFields(
                { name: '🧑 Senin Kartların', value: `${playerHand.join(', ')} (Toplam: ${playerTotal})`, inline: true },
                { name: '🤵 Krupiye Kartları', value: `${dealerHand.join(', ')} (Toplam: ${dealerTotal})`, inline: true },
                { name: 'Sonuç', value: sonucMetni, inline: false }
            );

        return message.reply({ embeds: [bjEmbed] });
    }
});

client.login(process.env.TOKEN).catch(err => {
    console.error("❌ TOKEN HATASI:", err);
});
