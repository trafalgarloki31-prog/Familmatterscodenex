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
            children: [],
            fame: 0,
            countries: {},
            clubs: [],
            slaves: [],
            enslavedBy: null,
            mafia: null
        };
    }
    if (!db.users[userId].children) db.users[userId].children = [];
    if (!db.users[userId].inventory.netherit) db.users[userId].inventory.netherit = 0;
    if (!db.users[userId].inventory.su) db.users[userId].inventory.su = 0;
    if (typeof db.users[userId].fame !== 'number') db.users[userId].fame = 0;
    if (!db.users[userId].countries) db.users[userId].countries = {};
    if (!db.users[userId].clubs) db.users[userId].clubs = [];
    if (!db.users[userId].slaves) db.users[userId].slaves = [];
    if (db.users[userId].enslavedBy === undefined) db.users[userId].enslavedBy = null;
    if (db.users[userId].mafia === undefined) db.users[userId].mafia = null;
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
    'ak parti milletvekili': { name: 'AK Parti Milletvekili', minLevel: 100, basePay: 25000, flavor: 'mecliste konuşma yaptın' },
    'cumhurbaşkanı': { name: 'Cumhurbaşkanı', minLevel: 100, basePay: 500000000, flavor: 'ülkeyi yönettin', fameBonus: 200 }
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
 
// -------------------------------------------------------------
// 🌍 ÜLKE YATIRIM SİSTEMİ (savunma sanayisine göre fiyatlandırma)
// -------------------------------------------------------------
// tier ne kadar yüksekse savunma sanayisi o kadar güçlü -> %10'luk dilim o kadar pahalı (200M-300M aralığı)
const COUNTRIES = {
    abd: { name: 'ABD', tier: 5, per10: 300000000 },
    rusya: { name: 'Rusya', tier: 5, per10: 295000000 },
    cin: { name: 'Çin', tier: 5, per10: 290000000 },
    turkiye: { name: 'Türkiye', tier: 4, per10: 280000000 },
    israil: { name: 'İsrail', tier: 4, per10: 275000000 },
    fransa: { name: 'Fransa', tier: 4, per10: 270000000 },
    ingiltere: { name: 'İngiltere', tier: 4, per10: 265000000 },
    almanya: { name: 'Almanya', tier: 3, per10: 255000000 },
    hindistan: { name: 'Hindistan', tier: 3, per10: 250000000 },
    guneykore: { name: 'Güney Kore', tier: 3, per10: 245000000 },
    japonya: { name: 'Japonya', tier: 2, per10: 230000000 },
    italya: { name: 'İtalya', tier: 2, per10: 225000000 },
    brezilya: { name: 'Brezilya', tier: 2, per10: 220000000 },
    misir: { name: 'Mısır', tier: 1, per10: 205000000 },
    endonezya: { name: 'Endonezya', tier: 1, per10: 200000000 }
};
const COUNTRY_FAME_PER_10 = 5; // her %10 ülke hissesi şöhrete küçük bonus verir
 
// -------------------------------------------------------------
// ⚽ FUTBOL TAKIMLARI
// -------------------------------------------------------------
const FOOTBALL_CLUBS = {
    galatasaray: { name: 'Galatasaray', price: 50000000, tax: 20000000 },
    fenerbahce: { name: 'Fenerbahçe', price: 50000000, tax: 20000000 },
    besiktas: { name: 'Beşiktaş', price: 50000000, tax: 20000000 },
    trabzonspor: { name: 'Trabzonspor', price: 45000000, tax: 18000000 },
    realmadrid: { name: 'Real Madrid', price: 55000000, tax: 22000000 },
    barcelona: { name: 'Barcelona', price: 55000000, tax: 22000000 },
    manchesterunited: { name: 'Manchester United', price: 52000000, tax: 21000000 },
    liverpool: { name: 'Liverpool', price: 52000000, tax: 21000000 },
    bayern: { name: 'Bayern Münih', price: 53000000, tax: 21000000 },
    psg: { name: 'Paris Saint-Germain', price: 54000000, tax: 21000000 }
};
const CLUB_FAME_BONUS = 0.50; // sahip olunca şöhret kazancına %50 bonus
 
// -------------------------------------------------------------
// ⭐ ŞÖHRET SİSTEMİ
// -------------------------------------------------------------
// Her çalışmada temel şöhret kazancı iş maaşına göre %3'lük dilimlerle ölçeklenir.
function sohretKazanciHesapla(u, job) {
    let taban = Math.max(1, Math.round((job.basePay / 1000) * 0.03));
    if (job.fameBonus) taban += job.fameBonus; // özel yüksek makam bonusu (örn. cumhurbaşkanı)
    let carpan = 1;
    if (u.clubs && u.clubs.length > 0) carpan += CLUB_FAME_BONUS * u.clubs.length;
    const ulkeSayisi = u.countries ? Object.keys(u.countries).length : 0;
    if (ulkeSayisi > 0) {
        let ulkeBonus = 0;
        for (const key in u.countries) {
            ulkeBonus += (u.countries[key] / 10) * COUNTRY_FAME_PER_10;
        }
        taban += Math.round(ulkeBonus);
    }
    return Math.round(taban * carpan);
}
 
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
 
// -------------------------------------------------------------
// ⛓️ KÖLE SİSTEMİ
// -------------------------------------------------------------
// Her köle, sahibine dakikada bir %50 ihtimalle 1 elmas kazandırır.
const SLAVE_MARKET_PRICE = 25000; // pazardan doğrudan köle satın alma fiyatı
setInterval(() => {
    for (const userId in db.users) {
        const u = db.users[userId];
        if (!u.slaves || u.slaves.length === 0) continue;
        for (let i = 0; i < u.slaves.length; i++) {
            if (Math.random() < 0.5) {
                u.inventory.elmas += 1;
            }
        }
    }
}, 60 * 1000);
 
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
const pendingCasinoInvites = new Map(); // guildId_challengedId -> {challengerId, bahis, expires}
 
// 🔫 Suç sistemi (Level 50+)
const CRIME_MIN_LEVEL = 50;
const HIRSIZ_MAX_STEAL = 20000;
const HIRSIZ_KOMISYON = 0.02;
const HIRSIZ_BASARI_SANSI = 0.20;
const TETIKCI_BASARI_SANSI = 0.10;
 
// -------------------------------------------------------------
// 🕴️ MAFYA SİSTEMİ
// -------------------------------------------------------------
const MAFIA_KURMA_MALIYETI = 5000000;
const MAFIA_GELIR = 10000000; // mafya kurunca / yönetince alınan getiri (çalış benzeri, cooldown ile)
const MAFIA_HIRSIZ_BASARI_SANSI = 1.0; // mafya üyeleri için hırsız başarı şansı %100
const MAFIA_TETIKCI_BASARI_SANSI = 0.60; // mafya üyeleri için tetikçi başarı şansı %60
const mafias = {}; // mafyaId -> { name, bossId, members: [], balance, lastGelir }
 
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
                    name: '🌍 Ülke & ⚽ Kulüp Yatırımı',
                    value: '`!ülkeler` • Ülke listesini ve %10 dilim fiyatlarını gösterir.\n`!ülke al <ülke> <yüzde>` • Ülkeden hisse alır (10\'un katları).\n`!kulüpler` • Futbol kulübü piyasası.\n`!kulüp al <kulüp>` • Kulüp satın alır (fiyat+vergi).'
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
                    name: '🎰 Oyunlar & 🎲 Kumarhane',
                    value: '`!blackjack <bahis>` • Blackjack oynar.\n`!slot <bahis>` • Slot çevirir.\n`!kumarhane davet @kişi <bahis>` • Karşılıklı kumar daveti yollar (kaybeden her şeyini kaybeder).\n`!kumarhane kabul` • Daveti kabul eder.'
                },
                {
                    name: '🔫 Suç (Lv. 50+)',
                    value: '`!hırsız tut @kişi` • Para çalmayı dener (max 20K, %20 şans).\n`!tetikçi tut @kişi` • Suikast dener (%10 şans, başarılı olursa hedefin tüm parası gider).'
                },
                {
                    name: '🕴️ Mafya',
                    value: '`!mafya kur <isim>` • Mafya kurar.\n`!mafya katıl @patron` • Bir mafyaya katılır.\n`!mafya bilgi` • Mafya bilgisi.\n`!mafya düello @patron` • İki patron kapışır, kaybeden mafyasını kaybeder.'
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
        const kulupIsimleri = u.clubs && u.clubs.length > 0 ? u.clubs.map(k => FOOTBALL_CLUBS[k]?.name || k).join(', ') : 'Yok';
        const ulkeSatirlari = u.countries && Object.keys(u.countries).length > 0
            ? Object.entries(u.countries).map(([k, yuzde]) => `${COUNTRIES[k]?.name || k}: %${yuzde}`).join(', ')
            : 'Yok';
        const varliklarValue = `🏠 Ev: ${u.house ? HOUSES[u.house].name : 'Yok'}\n🚗 Araç: ${u.vehicle ? VEHICLES[u.vehicle].name : 'Yok'}\n👶 Çocuk: ${cocukSayisi}\n⚽ Kulüp: ${kulupIsimleri}\n🌍 Ülke Hisseleri: ${ulkeSatirlari}`;
 
        let durumSatiri = '';
        if (u.enslavedBy) durumSatiri = `⛓️ <@${u.enslavedBy}> kişisinin kölesi`;
        if (u.slaves && u.slaves.length > 0) durumSatiri += `${durumSatiri ? '\n' : ''}👑 ${u.slaves.length} köleye sahip`;
 
        const profileEmbed = new EmbedBuilder()
            .setTitle(`👤 ${targetUser.username} Profil Kartı`)
            .setColor('#F1C40F')
            .addFields(
                { name: '💰 Fam Coin', value: `**${u.balance.toLocaleString()}** FC`, inline: true },
                { name: '💼 Meslek', value: `${u.job ? JOBS[u.job].name : 'İşsiz'}`, inline: true },
                { name: '⭐ Level', value: `Level **${u.level}**`, inline: true },
                { name: '🌟 Şöhret', value: `**${u.fame.toLocaleString()}** puan`, inline: true },
                { name: '💞 Evlilik Durumu', value: evlilikBilgisi, inline: false },
                { name: '🏡 Varlıklar', value: varliklarValue, inline: false },
                { name: '📈 Yatırımlar', value: `🥇 Altın: ${u.inventory.altin}\n🥈 Gümüş: ${u.inventory.gumus}\n💎 Elmas: ${u.inventory.elmas}\n☢️ Uranyum: ${u.inventory.uranyum}\n🧪 Döl: ${u.inventory.dol}\n🟪 Netherit: ${u.inventory.netherit}\n💧 Su: ${u.inventory.su}`, inline: false }
            );
        if (durumSatiri) profileEmbed.addFields({ name: '⛓️ Durum', value: durumSatiri, inline: false });
        return message.reply({ embeds: [profileEmbed] });
    }
 
    if (command === '!işler' || command === '!isler') {
        const jobEmbed = new EmbedBuilder()
            .setTitle('💼 Mevcut İşler')
            .setColor('#3498DB')
            .setDescription(Object.entries(JOBS).map(([key, job]) =>
                `**${job.name}** • Min. Level: ${job.minLevel} • Taban Maaş: ${job.basePay.toLocaleString()} FC\nSeçmek için: \`!iş seç ${key}\``
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
        const sohretKazanci = sohretKazanciHesapla(userData, job);
        userData.fame += sohretKazanci;
        userData.lastWork = now;
 
        // Eskort işi FC yerine döl yatırımı olarak ödenir
        if (userData.job === 'eskort') {
            const dolMiktari = Math.max(1, Math.round(kazanc / MARKET.dol.price));
            userData.inventory.dol += dolMiktari;
            return message.reply(`💼 **${job.name}** olarak **${job.flavor}** ve **${dolMiktari} 🧪 Döl** kazandın! (+${sohretKazanci} 🌟 şöhret)`);
        }
 
        userData.balance += kazanc;
        return message.reply(`💼 **${job.name}** olarak **${job.flavor}** ve **${kazanc.toLocaleString()} FC** kazandın! (+${sohretKazanci} 🌟 şöhret)`);
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
            const job = JOBS[u.job];
            const kazanc = calismaKazanciHesapla(u);
            u.fame += sohretKazanciHesapla(u, job);
            if (u.job === 'eskort') {
                u.inventory.dol += Math.max(1, Math.round(kazanc / MARKET.dol.price));
            } else {
                u.balance += kazanc;
            }
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
    // 🌍 ÜLKE YATIRIMI
    // =========================================================
    if (command === '!ülkeler' || command === '!ulkeler') {
        const ulkeEmbed = new EmbedBuilder()
            .setTitle('🌍 Ülke Yatırım Piyasası')
            .setColor('#1ABC9C')
            .setDescription(Object.entries(COUNTRIES).map(([key, c]) =>
                `🎌 **${c.name}** (Savunma Tier: ${c.tier}) • %10 dilim: ${c.per10.toLocaleString()} FC\nSatın almak için: \`!ülke al ${key} <yüzde>\``
            ).join('\n\n'))
            .setFooter({ text: 'Yüzdeler 10\'un katları olmalıdır. Ülke hissesi şöhret puanını da artırır.' });
        return message.reply({ embeds: [ulkeEmbed] });
    }
 
    if (command === '!ülke' || command === '!ulke') {
        if (args[0]?.toLowerCase() !== 'al') return message.reply('❌ Doğru kullanım: `!ülke al <ülke> <yüzde>`');
        const ulkeKey = args[1]?.toLowerCase();
        const yuzde = parseInt(args[2]);
        const ulke = COUNTRIES[ulkeKey];
        if (!ulke) return message.reply('❌ Böyle bir ülke yok! `!ülkeler` ile listeye bakabilirsin.');
        if (!yuzde || yuzde <= 0 || yuzde % 10 !== 0) return message.reply('❌ Yüzde 10\'un katları olmalı (10, 20, 30...)!');
 
        const mevcutYuzde = userData.countries[ulkeKey] || 0;
        if (mevcutYuzde + yuzde > 100) return message.reply(`❌ Bir ülkenin en fazla %100'üne sahip olabilirsin! (Şu an: %${mevcutYuzde})`);
 
        const maliyet = (yuzde / 10) * ulke.per10;
        if (userData.balance < maliyet) return message.reply(`❌ Yeterli bakiyen yok! Gereken: **${maliyet.toLocaleString()} FC**`);
 
        userData.balance -= maliyet;
        userData.countries[ulkeKey] = mevcutYuzde + yuzde;
 
        return message.reply(`🎌 **${ulke.name}** ülkesinden **%${yuzde}** hisse satın aldın! (Toplam sahiplik: %${userData.countries[ulkeKey]}) Maliyet: **${maliyet.toLocaleString()} FC**`);
    }
 
    // =========================================================
    // ⚽ FUTBOL KULÜBÜ
    // =========================================================
    if (command === '!kulüpler' || command === '!kulupler') {
        const kulupEmbed = new EmbedBuilder()
            .setTitle('⚽ Futbol Kulübü Piyasası')
            .setColor('#E67E22')
            .setDescription(Object.entries(FOOTBALL_CLUBS).map(([key, kulup]) =>
                `⚽ **${kulup.name}** • Fiyat: ${kulup.price.toLocaleString()} FC + Vergi: ${kulup.tax.toLocaleString()} FC\nSatın almak için: \`!kulüp al ${key}\``
            ).join('\n\n'))
            .setFooter({ text: `Kulüp sahibi olmak şöhret kazancına %${CLUB_FAME_BONUS * 100} bonus verir.` });
        return message.reply({ embeds: [kulupEmbed] });
    }
 
    if (command === '!kulüp' || command === '!kulup') {
        if (args[0]?.toLowerCase() !== 'al') return message.reply('❌ Doğru kullanım: `!kulüp al <kulüp>`');
        const kulupKey = args[1]?.toLowerCase();
        const kulup = FOOTBALL_CLUBS[kulupKey];
        if (!kulup) return message.reply('❌ Böyle bir kulüp yok! `!kulüpler` ile piyasaya bakabilirsin.');
        if (userData.clubs.includes(kulupKey)) return message.reply('❌ Bu kulübe zaten sahipsin!');
 
        const toplamMaliyet = kulup.price + kulup.tax;
        if (userData.balance < toplamMaliyet) return message.reply(`❌ Yeterli bakiyen yok! Gereken: **${toplamMaliyet.toLocaleString()} FC** (fiyat + vergi)`);
 
        userData.balance -= toplamMaliyet;
        userData.clubs.push(kulupKey);
        return message.reply(`⚽ **${kulup.name}** kulübünü satın aldın! Artık şöhret kazancına **%${CLUB_FAME_BONUS * 100}** bonus alıyorsun.`);
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
    // ⛓️ KÖLE PAZARI
    // =========================================================
    if (command === '!köle' || command === '!kole') {
        const sub = args[0]?.toLowerCase();
 
        if (sub === 'al') {
            if (userData.balance < SLAVE_MARKET_PRICE) return message.reply(`❌ Yeterli bakiyen yok! Gereken: **${SLAVE_MARKET_PRICE.toLocaleString()} FC**`);
            userData.balance -= SLAVE_MARKET_PRICE;
            userData.slaves.push({ source: 'pazar', acquiredAt: Date.now() });
            return message.reply(`⛓️ Pazardan bir köle satın aldın! (**${SLAVE_MARKET_PRICE.toLocaleString()} FC**) Artık dakikada bir %50 ihtimalle **1 💎 Elmas** kazandırıyor.`);
        }
 
        if (sub === 'sat') {
            if (!userData.slaves || userData.slaves.length === 0) return message.reply('❌ Hiç kölen yok!');
            userData.slaves.pop();
            const satisFiyati = Math.round(SLAVE_MARKET_PRICE * 0.5);
            userData.balance += satisFiyati;
            return message.reply(`✅ Bir köleyi sattın ve **${satisFiyati.toLocaleString()} FC** kazandın.`);
        }
 
        return message.reply(`❌ Doğru kullanım: \`!köle al\` (pazardan satın al, ${SLAVE_MARKET_PRICE.toLocaleString()} FC) veya \`!köle sat\``);
    }
 
    if (command === '!kölelerim' || command === '!kolelerim') {
        if (!userData.slaves || userData.slaves.length === 0) return message.reply('⛓️ Hiç kölen yok.');
        return message.reply(`⛓️ Toplam **${userData.slaves.length}** kölen var. Her biri dakikada bir %50 ihtimalle 1 💎 Elmas kazandırıyor.`);
    }
 
    // =========================================================
    // 🎲 KUMARHANE (PvP - kaybeden her şeyini kaybeder)
    // =========================================================
    if (command === '!kumarhane') {
        const sub = args[0]?.toLowerCase();
 
        if (sub === 'davet') {
            const target = message.mentions.users.first();
            const bahis = parseInt(args[2]);
            if (!target) return message.reply('❌ Doğru kullanım: `!kumarhane davet @kişi <bahis>`');
            if (target.id === message.author.id) return message.reply('❌ Kendinle oynayamazsın!');
            if (target.bot) return message.reply('❌ Bir bota kumar teklif edemezsin!');
            if (!bahis || bahis <= 0) return message.reply('❌ Geçerli bir bahis miktarı gir!');
            if (userData.balance < bahis) return message.reply('❌ Yeterli bakiyen yok!');
 
            const key = `${message.guild.id}_${target.id}`;
            pendingCasinoInvites.set(key, { challengerId: message.author.id, bahis, expires: Date.now() + 60000 });
 
            return message.reply(`🎲 <@${target.id}>, **${message.author.username}** seni kumarhaneye davet etti! Bahis: **${bahis.toLocaleString()} FC**.\n⚠️ Bu ciddi bir bahis: kaybeden tarafın **tüm parası, eşi ve çocukları** kazanana geçer ve köle olarak çalışmaya başlar!\nKabul etmek için 60 saniye içinde \`!kumarhane kabul\` yaz.`);
        }
 
        if (sub === 'kabul') {
            const key = `${message.guild.id}_${message.author.id}`;
            const invite = pendingCasinoInvites.get(key);
            if (!invite) return message.reply('❌ Sana bekleyen bir kumarhane daveti yok!');
            if (Date.now() > invite.expires) {
                pendingCasinoInvites.delete(key);
                return message.reply('❌ Davetin süresi doldu!');
            }
 
            const challengerData = getUser(invite.challengerId);
            const defenderData = userData;
 
            if (challengerData.balance < invite.bahis || defenderData.balance < invite.bahis) {
                pendingCasinoInvites.delete(key);
                return message.reply('❌ Taraflardan birinin bahis miktarı kadar bakiyesi kalmamış, oyun iptal edildi!');
            }
 
            pendingCasinoInvites.delete(key);
 
            // Kazananı %50-%50 belirle
            const defenderKazandi = Math.random() < 0.5;
            const winnerId = defenderKazandi ? message.author.id : invite.challengerId;
            const loserId = defenderKazandi ? invite.challengerId : message.author.id;
            const winnerData = getUser(winnerId);
            const loserData = getUser(loserId);
 
            // Kaybedenin tüm parası kazanana geçer
            const kaybedilenPara = loserData.balance;
            winnerData.balance += kaybedilenPara;
            loserData.balance = 0;
 
            // Kaybedenin eşi de aynı akıbeti paylaşır (varsa)
            let esMetni = '';
            if (loserData.marriedTo) {
                const esData = getUser(loserData.marriedTo);
                esData.enslavedBy = winnerId;
                winnerData.slaves.push({ source: 'kumarhane-eş', originalUserId: loserData.marriedTo, acquiredAt: Date.now() });
                esMetni = `\n💍 <@${loserData.marriedTo}> de köle olarak el değiştirdi!`;
            }
 
            // Kaybedenin çocukları da köle statüsüne geçer (kazanana bağlı köle kaydı olarak eklenir)
            let cocukMetni = '';
            if (loserData.children && loserData.children.length > 0) {
                for (const child of loserData.children) {
                    winnerData.slaves.push({ source: 'kumarhane-çocuk', acquiredAt: Date.now() });
                }
                cocukMetni = `\n👶 ${loserData.children.length} çocuğu da köle olarak devredildi!`;
                loserData.children = [];
            }
 
            loserData.enslavedBy = winnerId;
            winnerData.slaves.push({ source: 'kumarhane', originalUserId: loserId, acquiredAt: Date.now() });
 
            return message.reply(`🎲 **KUMARHANE SONUCU** 🎲\n<@${winnerId}> kazandı! <@${loserId}> her şeyini kaybetti: **${kaybedilenPara.toLocaleString()} FC**, ve artık <@${winnerId}> kişisinin kölesi oldu!${esMetni}${cocukMetni}`);
        }
 
        return message.reply('❌ Doğru kullanım: `!kumarhane davet @kişi <bahis>` veya `!kumarhane kabul`');
    }
 
    // =========================================================
    // 🕴️ MAFYA
    // =========================================================
    if (command === '!mafya') {
        const sub = args[0]?.toLowerCase();
 
        if (sub === 'kur') {
            if (userData.mafia) return message.reply('❌ Zaten bir mafyaya üyesin!');
            const isim = args.slice(1).join(' ');
            if (!isim) return message.reply('❌ Doğru kullanım: `!mafya kur <isim>`');
            if (userData.balance < MAFIA_KURMA_MALIYETI) return message.reply(`❌ Mafya kurmak için **${MAFIA_KURMA_MALIYETI.toLocaleString()} FC** gerekiyor!`);
 
            userData.balance -= MAFIA_KURMA_MALIYETI;
            const mafyaId = `${message.guild.id}_${message.author.id}_${Date.now()}`;
            mafias[mafyaId] = { name: isim, bossId: message.author.id, members: [message.author.id], balance: 0, lastGelir: 0 };
            userData.mafia = mafyaId;
 
            return message.reply(`🕴️ **${isim}** mafyasını kurdun! Artık patronusun. Üyelerin hırsızlık başarı şansı **%${MAFIA_HIRSIZ_BASARI_SANSI * 100}**, tetikçilik başarı şansı **%${MAFIA_TETIKCI_BASARI_SANSI * 100}** oldu.`);
        }
 
        if (sub === 'katıl' || sub === 'katil') {
            const target = message.mentions.users.first();
            if (!target) return message.reply('❌ Doğru kullanım: `!mafya katıl @patron`');
            if (userData.mafia) return message.reply('❌ Zaten bir mafyaya üyesin!');
 
            const targetData = getUser(target.id);
            if (!targetData.mafia || mafias[targetData.mafia]?.bossId !== target.id) {
                return message.reply('❌ Bu kişi bir mafya patronu değil!');
            }
 
            mafias[targetData.mafia].members.push(message.author.id);
            userData.mafia = targetData.mafia;
            return message.reply(`🕴️ **${mafias[targetData.mafia].name}** mafyasına katıldın!`);
        }
 
        if (sub === 'bilgi') {
            if (!userData.mafia || !mafias[userData.mafia]) return message.reply('❌ Bir mafyaya üye değilsin!');
            const m = mafias[userData.mafia];
            return message.reply(`🕴️ **${m.name}**\n👑 Patron: <@${m.bossId}>\n👥 Üye Sayısı: ${m.members.length}\n💰 Kasa: ${m.balance.toLocaleString()} FC`);
        }
 
        if (sub === 'gelir') {
            if (!userData.mafia || !mafias[userData.mafia]) return message.reply('❌ Bir mafyaya üye değilsin!');
            const m = mafias[userData.mafia];
            if (m.bossId !== message.author.id) return message.reply('❌ Sadece patron geliri toplayabilir!');
            const now = Date.now();
            if (now - m.lastGelir < WORK_COOLDOWN) {
                return message.reply(`⏳ Geliri henüz toplayamazsın, biraz bekle!`);
            }
            m.lastGelir = now;
            userData.balance += MAFIA_GELIR;
            return message.reply(`💰 Mafya geliri olarak **${MAFIA_GELIR.toLocaleString()} FC** topladın!`);
        }
 
        if (sub === 'düello' || sub === 'duello') {
            const target = message.mentions.users.first();
            if (!target) return message.reply('❌ Doğru kullanım: `!mafya düello @patron`');
            if (!userData.mafia || mafias[userData.mafia]?.bossId !== message.author.id) {
                return message.reply('❌ Sadece mafya patronları düello yapabilir!');
            }
            const targetData = getUser(target.id);
            if (!targetData.mafia || mafias[targetData.mafia]?.bossId !== target.id) {
                return message.reply('❌ Hedef bir mafya patronu değil!');
            }
            if (target.id === message.author.id) return message.reply('❌ Kendinle düello yapamazsın!');
 
            const myMafia = mafias[userData.mafia];
            const targetMafia = mafias[targetData.mafia];
 
            // Rus ruleti tarzı: %50 ihtimalle taraflardan biri kazanır, kaybeden mafyasını kaybeder
            const meKazandi = Math.random() < 0.5;
            const kazananMafia = meKazandi ? myMafia : targetMafia;
            const kaybedenMafia = meKazandi ? targetMafia : myMafia;
            const kaybedenBossId = kaybedenMafia.bossId;
            const kazananBossId = kazananMafia.bossId;
 
            // Kaybeden mafyanın kasası ve üyeleri kazanan mafyaya devrolur
            kazananMafia.balance += kaybedenMafia.balance;
            for (const memberId of kaybedenMafia.members) {
                const memberData = getUser(memberId);
                memberData.mafia = null;
            }
            kaybedenMafia.members = [];
            kaybedenMafia.balance = 0;
 
            return message.reply(`🔫 **RUS RULETİ SONUCU** 🔫\n<@${kazananBossId}> kazandı! <@${kaybedenBossId}> kişisinin **${kaybedenMafia.name}** mafyası dağıldı ve tüm kasası el değiştirdi!`);
        }
 
        return message.reply('❌ Doğru kullanım: `!mafya kur <isim>` | `!mafya katıl @patron` | `!mafya bilgi` | `!mafya gelir` | `!mafya düello @patron`');
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
        const basariSansi = (userData.mafia && mafias[userData.mafia]) ? MAFIA_HIRSIZ_BASARI_SANSI : HIRSIZ_BASARI_SANSI;
        const basarili = Math.random() < basariSansi;
 
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
        const basariSansi = (userData.mafia && mafias[userData.mafia]) ? MAFIA_TETIKCI_BASARI_SANSI : TETIKCI_BASARI_SANSI;
        const basarili = Math.random() < basariSansi;
 
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
 
