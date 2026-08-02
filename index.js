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
const fs = require('fs');

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
const DB_PATH = './database.json';

function veriYukle() {
    try {
        if (fs.existsSync(DB_PATH)) {
            const raw = fs.readFileSync(DB_PATH, 'utf8');
            return JSON.parse(raw);
        }
    } catch (err) {
        console.error('❌ Veritabanı okunurken hata:', err);
    }
    return { users: {} };
}

function veriKaydet() {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(db));
    } catch (err) {
        console.error('❌ Veritabanı kaydedilirken hata:', err);
    }
}

const db = veriYukle();

// Her 30 saniyede bir otomatik kayıt
setInterval(veriKaydet, 30 * 1000);

// Bot kapanırken de kaydet (crash/restart durumlarında veri kaybını azaltır)
process.on('SIGINT', () => { veriKaydet(); process.exit(0); });
process.on('SIGTERM', () => { veriKaydet(); process.exit(0); });

const WORK_COOLDOWN = 30 * 1000; // 30 saniye

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
            inventory: { altin: 0, gumus: 0, elmas: 0, uranyum: 0, dol: 0, netherit: 0, su: 0 },
            lastWork: 0,
            house: null,
            vehicle: null,
            children: []
        };
    }
    if (!db.users[userId].children) db.users[userId].children = [];
    if (!db.users[userId].inventory.netherit) db.users[userId].inventory.netherit = 0;
    if (!db.users[userId].inventory.su) db.users[userId].inventory.su = 0;
    return db.users[userId];
}

// İş listesi (sıralama = maaş sıralaması)
const JOBS = {
    'sanayi': { name: 'Sanayi İşçisi', minLevel: 1, basePay: 200, flavor: 'ustana yardım ettin' },
    'sahte ayakkabıcı': { name: 'Sahte Ayakkabıcı', minLevel: 5, basePay: 450, flavor: 'sahte ayakkabıları müşterilere kaydırdın' },
    'eskort': { name: 'Eskort', minLevel: 10, basePay: 800, flavor: 'müşterine eşlik ettin' },
    'spotify sanatçısı': { name: 'Spotify Sanatçısı', minLevel: 20, basePay: 1500, flavor: 'yeni bir single yayınladın' },
    'esnaf': { name: 'Esnaf', minLevel: 20, basePay: 2200, flavor: 'dükkanında müşterilerle pazarlık ettin' },
    'şirket çalışanı': { name: 'Şirket Çalışanı', minLevel: 30, basePay: 3500, flavor: 'toplantıda sunum yaptın' },
    'patron': { name: 'Patron', minLevel: 40, basePay: 5500, flavor: 'çalışanlarına talimat verdin' },
    'yatırımcı': { name: 'Yatırımcı', minLevel: 60, basePay: 9000, flavor: 'borsada büyük bir hamle yaptın' },
    'büyük patron': { name: 'Büyük Patron', minLevel: 80, basePay: 15000, flavor: 'şirket imparatorluğunu genişlettin' },
    'ak parti milletvekili': { name: 'AK Parti Milletvekili', minLevel: 100, basePay: 25000, flavor: 'mecliste konuşma yaptın' }
};

// 🏠 Emlak sistemi
const HOUSES = {
    apartman: { name: 'Apartman Dairesi', price: 20000, minLevel: 20 },
    mustakil: { name: 'Müstakil Ev', price: 50000, minLevel: 20 },
    villa: { name: 'Villa', price: 150000, minLevel: 20 },
    malikane: { name: 'Malikane', price: 500000, minLevel: 20 }
};
const HOUSE_XP_BONUS = 0.10;

// 🚗 Araç sistemi
const VEHICLES = {
    murat131: { name: 'Murat 131', price: 8000, minLevel: 25 },
    doblo: { name: 'Fiat Doblo', price: 30000, minLevel: 25 },
    corolla: { name: 'Toyota Corolla', price: 80000, minLevel: 25 },
    maybach: { name: 'Maybach', price: 600000, minLevel: 25 },
    ucanaraba: { name: 'Uçan Araba', price: 1200000, minLevel: 25 },
    yuzenaraba: { name: 'Yüzen Araba', price: 900000, minLevel: 25 }
};
const VEHICLE_XP_BONUS = 0.05;

// 👶 Çocuk sistemi
const CHILD_BASE_MONTHLY_COST = 5000;
const CHILD_MONTHLY_INCREASE = 500; // her ay yaşı arttıkça masraf da artar
const CHILD_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const CHILD_INCOME_BONUS = 0.15; // her çocuk çalış kazancına %15 ekler
const CHILD_XP_BONUS = 0.20; // her çocuk seviye kazancına %20 ekler

// Yüzükler
const RINGS = {
    'tahta': { name: 'Tahta Yüzük', price: 500, emoji: '🥉' },
    'gümüş': { name: 'Gümüş Yüzük', price: 2500, emoji: '🥈' },
    'pırlanta': { name: 'Pırlanta Yüzük', price: 10000, emoji: '💍' },
    'kral': { name: 'Kral Yüzüğü', price: 50000, emoji: '👑' }
};

// Yatırım / Borsa sistemi
const MARKET = {
    altin: { name: 'Altın', emoji: '🥇', price: 2000, xpBonus: 0.05 },
    gumus: { name: 'Gümüş', emoji: '🥈', price: 500, xpBonus: 0.04 },
    elmas: { name: 'Elmas', emoji: '💎', price: 5000, xpBonus: 0.07 },
    uranyum: { name: 'Uranyum', emoji: '☢️', price: 9000, xpBonus: 0.10 },
    dol: { name: 'Döl', emoji: '🧪', price: 300, xpBonus: 0.02 },
    netherit: { name: 'Netherit', emoji: '🟪', price: 8500, xpBonus: 0.08 },
    su: { name: 'Su', emoji: '💧', price: 400, xpBonus: 0.03 }
};

function updateMarket() {
    for (const key in MARKET) {
        const changePercent = (Math.random() * 10 - 5) / 100; // -%5 ile +%5 arası
        MARKET[key].price = Math.max(10, Math.round(MARKET[key].price * (1 + changePercent)));
    }
}
setInterval(updateMarket, 5 * 60 * 1000); // Fiyatlar her 5 dakikada bir güncellenir

// XP çarpanını hesaplar: ev, araç, yatırımlar ve çocuklar bonus verir
function xpCarpaniHesapla(u) {
    let carpan = 1;
    if (u.house) carpan += HOUSE_XP_BONUS;
    if (u.vehicle) carpan += VEHICLE_XP_BONUS;
    const cocukSayisi = u.children ? u.children.length : 0;
    carpan += cocukSayisi * CHILD_XP_BONUS;
    for (const key in MARKET) {
        if (u.inventory[key] > 0) carpan += MARKET[key].xpBonus;
    }
    return carpan;
}

// Çalış kazancını hesaplar: level zammı ve çocuk bonusu dahil
function calismaKazanciHesapla(u) {
    const job = JOBS[u.job];
    if (!job) return 0;
    const levelZam = Math.pow(1.03, u.level - 1);
    const cocukSayisi = u.children ? u.children.length : 0;
    const cocukBonus = 1 + (cocukSayisi * CHILD_INCOME_BONUS);
    return Math.round(job.basePay * levelZam * cocukBonus);
}

// 👶 Çocuk yaşlanma ve aylık gider sistemi (her saat kontrol edilir)
setInterval(() => {
    const now = Date.now();
    for (const userId in db.users) {
        const u = db.users[userId];
        if (!u.children || u.children.length === 0) continue;
        for (const child of u.children) {
            if (now - child.lastCharged >= CHILD_MONTH_MS) {
                child.age += 1;
                const masraf = CHILD_BASE_MONTHLY_COST + (child.age * CHILD_MONTHLY_INCREASE);
                u.balance = Math.max(0, u.balance - masraf);
                child.lastCharged = now;
            }
        }
    }
}, 60 * 60 * 1000);

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
const autoWorkIntervals = new Map(); // otoçalış açık olan kullanıcılar

// 🔫 Suç sistemi (Level 50+)
const CRIME_MIN_LEVEL = 50;
const HIRSIZ_MAX_STEAL = 20000;
const HIRSIZ_KOMISYON = 0.02;
const HIRSIZ_BASARI_SANSI = 0.20;
const TETIKCI_BASARI_SANSI = 0.10;

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
    const xpCarpani = xpCarpaniHesapla(userData);
    userData.xp += Math.round(10 * xpCarpani); // her mesaj 10 xp (bonuslarla çarpılır)
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
                    value: '`!profil [@kişi]` • Profili gösterir.\n`!işler` • İş listesi.\n`!iş seç <isim>` • Bir iş seçer.\n`!çalış` • Çalışıp para kazanırsın (30 sn cooldown).\n`!gönder @kişi <miktar>` • Para gönderir.'
                },
                {
                    name: '📈 Borsa',
                    value: '`!borsa` • Güncel fiyatları gösterir.\n`!yatırım al <altın/gümüş/elmas/uranyum/döl/netherit/su> <miktar>` • Yatırım yapar.\n`!yatırım sat <...> <miktar>` • Satış yapar.'
                },
                {
                    name: '🏠 Emlak & 🚗 Araç',
                    value: '`!evler` • Emlak piyasası (Lv. 20).\n`!ev al <tür>` • Ev satın alır.\n`!araçlar` • Galeri (Lv. 25).\n`!araç al <tür>` • Araç satın alır.'
                },
                {
                    name: '💍 Evlilik & 👶 Aile',
                    value: '`!yüzükler` • Yüzük mağazası.\n`!yüzük al <tür>` • Yüzük satın alır.\n`!evlen @kişi` • Evlenme teklifi eder.\n`!boşan` • Boşanır.\n`!çocuk yap` • Çocuk sahibi olur (evlilik gerekir).\n`!çocuklar` • Çocuklarını listeler.'
                },
                {
                    name: '🎰 Oyunlar',
                    value: '`!blackjack <bahis>` • Blackjack oynar.\n`!slot <bahis>` • Slot çevirir.'
                },
                {
                    name: '🔫 Suç (Lv. 50+)',
                    value: '`!hırsız tut @kişi` • Para çalmayı dener (max 20K, %20 şans).\n`!tetikçi tut @kişi` • Suikast dener (%10 şans, başarılı olursa hedefin tüm parası gider).'
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

        const cocukSayisi = u.children ? u.children.length : 0;
        const varliklarValue = `🏠 Ev: ${u.house ? HOUSES[u.house].name : 'Yok'}\n🚗 Araç: ${u.vehicle ? VEHICLES[u.vehicle].name : 'Yok'}\n👶 Çocuk: ${cocukSayisi}`;

        const profileEmbed = new EmbedBuilder()
            .setTitle(`👤 ${targetUser.username} Profil Kartı`)
            .setColor('#F1C40F')
            .addFields(
                { name: '💰 Fam Coin', value: `**${u.balance.toLocaleString()}** FC`, inline: true },
                { name: '💼 Meslek', value: `${u.job ? JOBS[u.job].name : 'İşsiz'}`, inline: true },
                { name: '⭐ Level', value: `Level **${u.level}**`, inline: true },
                { name: '💞 Evlilik Durumu', value: evlilikBilgisi, inline: false },
                { name: '🏡 Varlıklar', value: varliklarValue, inline: false },
                { name: '📈 Yatırımlar', value: `🥇 Altın: ${u.inventory.altin}\n🥈 Gümüş: ${u.inventory.gumus}\n💎 Elmas: ${u.inventory.elmas}\n☢️ Uranyum: ${u.inventory.uranyum}\n🧪 Döl: ${u.inventory.dol}\n🟪 Netherit: ${u.inventory.netherit}\n💧 Su: ${u.inventory.su}`, inline: false }
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
            const saniye = Math.ceil(remaining / 1000);
            return message.reply(`⏳ Yorgunsun, dinlenmen lazım! **${saniye} saniye** sonra tekrar çalışabilirsin.`);
        }

        const job = JOBS[userData.job];
        const kazanc = calismaKazanciHesapla(userData);

        userData.balance += kazanc;
        userData.lastWork = now;

        return message.reply(`💼 **${job.name}** olarak **${job.flavor}** ve **${kazanc.toLocaleString()} FC** kazandın!`);
    }

    // 🤖 GİZLİ KOMUT: OTO ÇALIŞ (yardım listesinde görünmez)
    if (command === '!otoçalış' || command === '!otocalis') {
        const key = `${message.guild.id}_${message.author.id}`;

        if (autoWorkIntervals.has(key)) {
            clearInterval(autoWorkIntervals.get(key));
            autoWorkIntervals.delete(key);
            return message.reply('🛑 Oto çalış kapatıldı.');
        }

        if (!userData.job) return message.reply('❌ Önce bir iş seçmelisin! `!işler` yazarak bakabilirsin.');

        const intervalId = setInterval(() => {
            const u = getUser(message.author.id);
            if (!u.job) return;
            const kazanc = calismaKazanciHesapla(u);
            u.balance += kazanc;
            u.lastWork = Date.now();
        }, 30 * 1000);

        autoWorkIntervals.set(key, intervalId);
        return message.reply('🤖 Oto çalış açıldı! Artık her 30 saniyede bir otomatik para kazanacaksın. Kapatmak için tekrar `!otoçalış` yaz.');
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
    // 🏠 EMLAK (EV)
    // =========================================================
    if (command === '!evler') {
        const evEmbed = new EmbedBuilder()
            .setTitle('🏠 Emlak Piyasası')
            .setColor('#9B59B6')
            .setDescription(Object.entries(HOUSES).map(([key, ev]) =>
                `🏡 **${ev.name}** • ${ev.price.toLocaleString()} FC • Min. Level: ${ev.minLevel}\nSatın almak için: \`!ev al ${key}\``
            ).join('\n\n'))
            .setFooter({ text: `Ev sahibi olmak deneyim (XP) kazancına %${HOUSE_XP_BONUS * 100} bonus verir.` });
        return message.reply({ embeds: [evEmbed] });
    }

    if (command === '!ev') {
        if (args[0]?.toLowerCase() !== 'al') return message.reply('❌ Doğru kullanım: `!ev al <tür>`');
        const evKey = args[1]?.toLowerCase();
        const ev = HOUSES[evKey];
        if (!ev) return message.reply('❌ Böyle bir ev yok! `!evler` ile listeye bakabilirsin.');
        if (userData.level < ev.minLevel) return message.reply(`❌ Bu evi almak için en az **Level ${ev.minLevel}** olmalısın!`);
        if (userData.balance < ev.price) return message.reply('❌ Yeterli bakiyen yok!');

        userData.balance -= ev.price;
        userData.house = evKey;
        return message.reply(`🏡 **${ev.name}** satın aldın! Artık deneyim kazancına **%${HOUSE_XP_BONUS * 100}** bonus alıyorsun.`);
    }

    // =========================================================
    // 🚗 ARAÇ
    // =========================================================
    if (command === '!araçlar' || command === '!araclar') {
        const aracEmbed = new EmbedBuilder()
            .setTitle('🚗 Galeri')
            .setColor('#95A5A6')
            .setDescription(Object.entries(VEHICLES).map(([key, arac]) =>
                `🚘 **${arac.name}** • ${arac.price.toLocaleString()} FC • Min. Level: ${arac.minLevel}\nSatın almak için: \`!araç al ${key}\``
            ).join('\n\n'))
            .setFooter({ text: `Araç sahibi olmak deneyim (XP) kazancına %${VEHICLE_XP_BONUS * 100} bonus verir.` });
        return message.reply({ embeds: [aracEmbed] });
    }

    if (command === '!araç' || command === '!arac') {
        if (args[0]?.toLowerCase() !== 'al') return message.reply('❌ Doğru kullanım: `!araç al <tür>`');
        const aracKey = args[1]?.toLowerCase();
        const arac = VEHICLES[aracKey];
        if (!arac) return message.reply('❌ Böyle bir araç yok! `!araçlar` ile galeriye bakabilirsin.');
        if (userData.level < arac.minLevel) return message.reply(`❌ Bu aracı almak için en az **Level ${arac.minLevel}** olmalısın!`);
        if (userData.balance < arac.price) return message.reply('❌ Yeterli bakiyen yok!');

        userData.balance -= arac.price;
        userData.vehicle = aracKey;
        return message.reply(`🚘 **${arac.name}** satın aldın! Artık deneyim kazancına **%${VEHICLE_XP_BONUS * 100}** bonus alıyorsun.`);
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

        const itemMap = { 'altın': 'altin', 'altin': 'altin', 'gümüş': 'gumus', 'gumus': 'gumus', 'elmas': 'elmas', 'uranyum': 'uranyum', 'döl': 'dol', 'dol': 'dol', 'netherit': 'netherit', 'su': 'su' };
        const item = itemMap[itemKey];

        if (!['al', 'sat'].includes(action) || !item || !miktar || miktar <= 0) {
            return message.reply('❌ Doğru kullanım: `!yatırım al/sat <altın/gümüş/elmas/uranyum/döl/netherit/su> <miktar>`');
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
    // 👶 ÇOCUK
    // =========================================================
    if (command === '!çocuk' || command === '!cocuk') {
        if (args[0]?.toLowerCase() !== 'yap') return message.reply('❌ Doğru kullanım: `!çocuk yap`');
        if (!userData.marriedTo) return message.reply('❌ Çocuk yapabilmek için evli olman gerekiyor!');

        const esData = getUser(userData.marriedTo);
        const now = Date.now();

        userData.children.push({ age: 0, createdAt: now, lastCharged: now });
        esData.children.push({ age: 0, createdAt: now, lastCharged: now });

        return message.reply(`👶 Tebrikler! Bir çocuğunuz oldu! Aylık gideri **${CHILD_BASE_MONTHLY_COST.toLocaleString()} FC**'den başlayıp yaşı büyüdükçe artacak, ama çalış kazancına **%${CHILD_INCOME_BONUS * 100}** ve deneyime **%${CHILD_XP_BONUS * 100}** bonus verecek!`);
    }

    if (command === '!çocuklar' || command === '!cocuklar') {
        if (!userData.children || userData.children.length === 0) return message.reply('👶 Hiç çocuğun yok.');
        const liste = userData.children.map((c, i) => `**${i + 1}.** Yaş: ${c.age} ay`).join('\n');
        return message.reply(`👨‍👩‍👧‍👦 Çocukların:\n${liste}`);
    }

    // =========================================================
    // 🔫 SUÇ (Level 50+)
    // =========================================================
    if (command === '!hırsız' || command === '!hirsiz') {
        if (args[0]?.toLowerCase() !== 'tut') return message.reply('❌ Doğru kullanım: `!hırsız tut @kişi`');
        if (userData.level < CRIME_MIN_LEVEL) return message.reply(`❌ Bu komut için en az **Level ${CRIME_MIN_LEVEL}** olmalısın!`);

        const target = message.mentions.users.first();
        if (!target) return message.reply('❌ Doğru kullanım: `!hırsız tut @kişi`');
        if (target.id === message.author.id) return message.reply('❌ Kendinden çalamazsın!');

        const targetData = getUser(target.id);
        const basarili = Math.random() < HIRSIZ_BASARI_SANSI;

        if (!basarili) {
            return message.reply('🚔 Tuttuğun hırsız yakalandı, soygun başarısız oldu!');
        }

        const calinacakMiktar = Math.min(HIRSIZ_MAX_STEAL, targetData.balance);
        if (calinacakMiktar <= 0) return message.reply('❌ Bu kişinin çalacak parası yok!');

        const komisyon = Math.round(calinacakMiktar * HIRSIZ_KOMISYON);
        const netKazanc = calinacakMiktar - komisyon;

        targetData.balance -= calinacakMiktar;
        userData.balance += netKazanc;

        return message.reply(`🕵️ Soygun başarılı! <@${target.id}> kişisinden **${calinacakMiktar.toLocaleString()} FC** çalındı, hırsız komisyonu **${komisyon.toLocaleString()} FC** kesildi, sana **${netKazanc.toLocaleString()} FC** kaldı!`);
    }

    if (command === '!tetikçi' || command === '!tetikci') {
        if (args[0]?.toLowerCase() !== 'tut') return message.reply('❌ Doğru kullanım: `!tetikçi tut @kişi`');
        if (userData.level < CRIME_MIN_LEVEL) return message.reply(`❌ Bu komut için en az **Level ${CRIME_MIN_LEVEL}** olmalısın!`);

        const target = message.mentions.users.first();
        if (!target) return message.reply('❌ Doğru kullanım: `!tetikçi tut @kişi`');
        if (target.id === message.author.id) return message.reply('❌ Kendine tetikçi tutamazsın!');

        const targetData = getUser(target.id);
        const basarili = Math.random() < TETIKCI_BASARI_SANSI;

        if (!basarili) {
            return message.reply('🚔 Tetikçi yakalandı, suikast başarısız oldu!');
        }

        const kaybedilenPara = targetData.balance;
        targetData.balance = 0;

        return message.reply(`🔫 Suikast başarılı! <@${target.id}> kişisinin tüm parası (**${kaybedilenPara.toLocaleString()} FC**) yok edildi! Level'i aynı kaldı ama parası sıfırlandı.`);
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
