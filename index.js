require('dotenv').config();
const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  EmbedBuilder, 
  PermissionFlagsBits,
  ChannelType
} = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const http = require('http');

// Render / UptimeWeb sunucusu
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.write("Bot 7/24 Aktif!");
    res.end();
}).listen(process.env.PORT || 3000, () => {
    console.log("🌐 Web sunucusu aktif.");
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
// 💾 EKONOMİ & BİLGİ VERİTABANI
// -------------------------------------------------------------
const db = { users: {} };

function getUser(userId) {
    if (!db.users[userId]) {
        db.users[userId] = {
            balance: 1000,
            job: 'Sanayi',
            level: 1,
            xp: 0,
            marriedTo: null,
            ring: null,
            inventory: [],
            lastDaily: 0,
            lastMonthly: 0
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

// Takip Listeleri
const tempChannels = new Set();
const userMessageMap = new Map();
let copiedGuildData = null;

client.once('ready', () => {
  console.log(`🤖 Bot ${client.user.tag} olarak başarıyla aktifleşti!`);
});

// -------------------------------------------------------------
// ➕ GEÇİCİ SES ODASI SİSTEMİ (JOIN TO CREATE)
// -------------------------------------------------------------
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

// -------------------------------------------------------------
// 💬 MESAJ / OTO-MOD / KOMUT MANTIĞI
// -------------------------------------------------------------
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // 🛡️ OTO SPAM MODERASYONU
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
                        await message.member.timeout(60000, 'Oto-Mod: Spam Engeli');
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

    // LEVEL / XP SİSTEMİ
    const userData = getUser(message.author.id);
    userData.xp += Math.floor(Math.random() * 10) + 5;
    if (userData.xp >= userData.level * 100) {
        userData.level += 1;
        userData.xp = 0;
        message.channel.send(`🎉 Tebrikler <@${message.author.id}>! **Level ${userData.level}** oldun!`).catch(() => {});
    }

    // OTOMATİK SA-AS
    const lowerText = message.content.toLowerCase().trim();
    if (['sa', 'sea', 'selam', 'selamunaleykum', 'selamın aleyküm'].includes(lowerText)) {
        return message.reply(`Aleykümselam **${message.author.username}**, hoş geldin! 👋`);
    }

    const args = message.content.trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // -------------------------------------------------------------
    // 📖 BİREBİR FOTOĞRAFTAKİ YARDIM MENÜSÜ (!yardım)
    // -------------------------------------------------------------
    if (command === '!yardım' || command === '!help') {
        const helpEmbed = new EmbedBuilder()
            .setTitle('🤖 Bot Komut Listesi')
            .setColor('#5865F2')
            .addFields(
                { 
                    name: '🎙️ Ses Komutları', 
                    value: '`!katıl` • Bulunduğun ses kanalına girer ve 7/24 kalır.\n`!ayrıl` • Ses kanalından çıkar.\n`➕ Oda Oluştur` • Otomatik özel ses odası açar.' 
                },
                { 
                    name: '💼 Ekonomi & Meslekler', 
                    value: '`!profil` • Profil ve bakiyeni gösterir.\n`!işler` • Meslekleri gösterir.\n`!iş-gir <meslek>` • İşe girersin.\n`!günlük` • Günlük maaşını alırsın.\n`!aylık` • Aylık maaşını alırsın.\n`!transfer @kullanıcı <miktar>` • Para gönderirsin.' 
                },
                { 
                    name: '💍 Evlilik & Mağaza', 
                    value: '`!market` • Yüzük mağazasını açar.\n`!satınal <yüzük>` • Yüzük satın alırsın.\n`!evlen @kullanıcı <yüzük>` • Yüzükle evlenirsin.\n`!boşan` • Boşanırsın.' 
                },
                { 
                    name: '🛠️ Yönetim & Moderasyon', 
                    value: '`!kur` • Sunucuyu kurar.\n`!duyuru <mesaj>` • Duyuru yapar.\n`!ban` / `!kick` / `!timeout` • Cezalar.\n`!sil <miktar>` • Temizlik.' 
                },
                { 
                    name: '🎁 Oyun & Eğlence', 
                    value: '`!ücretsiz-oyun` • Bedava oyunları gösterir.\n`!slot` • Slot oynatır.\n`!love @kullanıcı` • Aşk ölçer.\n`!zar` • `!yazı-tura` • `!8ball`' 
                }
            )
            .setFooter({ text: 'FAM • Sistem rehberi' });

        return message.reply({ embeds: [helpEmbed] });
    }

    // 🎙️ SES KOMUTLARI
    if (command === '!katıl' || command === '!katil' || command === '!join') {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply('❌ Önce bir ses kanalına girmelisin kanka!');
        try {
            joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
                selfDeaf: true
            });
            return message.reply(`🔊 **${voiceChannel.name}** kanalına katıldım! Artık 7/24 buradayım.`);
        } catch (e) { return message.reply('❌ Sese katılırken hata oluştu!'); }
    }

    if (command === '!ayrıl' || command === '!ayril') {
        const connection = getVoiceConnection(message.guild.id);
        if (!connection) return message.reply('❌ Seste değilim kanka!');
        connection.destroy();
        return message.reply('👋 Ses kanalından ayrıldım.');
    }

    // 💼 EKONOMİ & EVLİLİK
    if (command === '!profil' || command === '!bakiye') {
        const targetUser = message.mentions.users.first() || message.author;
        const u = getUser(targetUser.id);
        const spouseText = u.marriedTo ? `<@${u.marriedTo}> (${u.ring || 'Yüzük Yok'})` : 'Bekar 💔';
        const invText = u.inventory.length > 0 ? u.inventory.join(', ') : 'Yok';

        const profileEmbed = new EmbedBuilder()
            .setTitle(`👤 ${targetUser.username} Profil Kartı`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .setColor('#F1C40F')
            .addFields(
                { name: '💰 Fam Coin', value: `**${u.balance.toLocaleString()}** FC`, inline: true },
                { name: '💼 Meslek', value: `${u.job}`, inline: true },
                { name: '⭐ Level / XP', value: `Level **${u.level}** (${u.xp}/${u.level * 100} XP)`, inline: true },
                { name: '❤️ Evlilik Durumu', value: spouseText, inline: false },
                { name: '🎒 Envanter', value: invText, inline: false }
            );

        return message.reply({ embeds: [profileEmbed] });
    }

    if (command === '!işler' || command === '!isler') {
        const jobsEmbed = new EmbedBuilder()
            .setTitle('💼 Mevcut Meslekler')
            .setColor('#3498DB')
            .addFields(
                { name: '🛠️ Sanayi', value: 'Gereksinim: **Level 1** | Günlük: 500 FC | Aylık: 5.000 FC', inline: false },
                { name: '👟 Sahte Ayakkabıcı', value: 'Gereksinim: **Level 10** | Günlük: 1.500 FC | Aylık: 15.000 FC', inline: false },
                { name: '👠 Eskort', value: 'Gereksinim: **Level 20** | Günlük: 3.500 FC | Aylık: 35.000 FC', inline: false },
                { name: '💻 Yazılımcı', value: 'Gereksinim: **Level 30** | Günlük: 7.500 FC | Aylık: 75.000 FC', inline: false }
            );
        return message.reply({ embeds: [jobsEmbed] });
    }

    if (command === '!iş-gir' || command === '!is-gir') {
        const jobQuery = args.join(' ').toLowerCase();
        const selectedJob = JOBS[jobQuery];
        if (!selectedJob) return message.reply('❌ Geçersiz meslek! Listeye bak: `!işler`');
        if (userData.level < selectedJob.minLevel) return message.reply(`❌ Bu iş için Level ${selectedJob.minLevel} olmalısın!`);
        userData.job = selectedJob.name;
        return message.reply(`🎉 Artık **${selectedJob.name}** olarak çalışıyorsun.`);
    }

    if (command === '!günlük' || command === '!gunluk') {
        const now = Date.now();
        if (now - userData.lastDaily < 86400000) return message.reply('⏳ Günlük maaşını zaten aldın!');
        const currentJobKey = Object.keys(JOBS).find(k => JOBS[k].name === userData.job) || 'sanayi';
        const salary = JOBS[currentJobKey].daily;
        userData.balance += salary;
        userData.lastDaily = now;
        return message.reply(`💵 **${salary.toLocaleString()} FC** günlük maaşını aldın!`);
    }

    if (command === '!aylık' || command === '!aylik') {
        const now = Date.now();
        if (now - userData.lastMonthly < 2592000000) return message.reply('⏳ Aylık maaşını zaten aldın!');
        const currentJobKey = Object.keys(JOBS).find(k => JOBS[k].name === userData.job) || 'sanayi';
        const salary = JOBS[currentJobKey].monthly;
        userData.balance += salary;
        userData.lastMonthly = now;
        return message.reply(`💰 **${salary.toLocaleString()} FC** aylık maaşını aldın!`);
    }

    if (command === '!transfer') {
        const target = message.mentions.users.first();
        const amount = parseInt(args[1]);
        if (!target || isNaN(amount) || amount <= 0) return message.reply('❌ Doğru kullanım: `!transfer @kullanıcı <miktar>`');
        if (userData.balance < amount) return message.reply('❌ Bakiyen yetersiz!');
        const targetData = getUser(target.id);
        userData.balance -= amount;
        targetData.balance += amount;
        return message.reply(`💸 <@${target.id}> kişisine **${amount.toLocaleString()} FC** aktarıldı!`);
    }

    if (command === '!market') {
        const marketEmbed = new EmbedBuilder()
            .setTitle('🏪 Yüzük Mağazası')
            .setColor('#E91E63')
            .addFields(
                { name: '🥉 Tahta Yüzük', value: '500 FC', inline: true },
                { name: '🥈 Gümüş Yüzük', value: '2.500 FC', inline: true },
                { name: '💍 Pırlanta Yüzük', value: '10.000 FC', inline: true },
                { name: '👑 Kral Yüzüğü', value: '50.000 FC', inline: true }
            );
        return message.reply({ embeds: [marketEmbed] });
    }

    if (command === '!satınal' || command === '!satinal') {
        const ringKey = args[0]?.toLowerCase();
        const ring = RINGS[ringKey];
        if (!ring) return message.reply('❌ Geçersiz yüzük!');
        if (userData.balance < ring.price) return message.reply('❌ Bakiyen yetersiz!');
        userData.balance -= ring.price;
        userData.inventory.push(`${ring.emoji} ${ring.name}`);
        return message.reply(`🛍️ **${ring.emoji} ${ring.name}** satın aldın!`);
    }

    if (command === '!evlen') {
        const target = message.mentions.users.first();
        const ringKey = args[1]?.toLowerCase();
        if (!target || target.id === message.author.id) return message.reply('❌ Geçersiz kişi!');
        const targetData = getUser(target.id);
        if (userData.marriedTo || targetData.marriedTo) return message.reply('❌ Taraflardan biri zaten evli!');
        const ring = RINGS[ringKey];
        if (!ring) return message.reply('❌ Örn: `!evlen @kullanıcı tahta`');
        const ringString = `${ring.emoji} ${ring.name}`;
        const idx = userData.inventory.indexOf(ringString);
        if (idx === -1) return message.reply(`❌ Envanterinde bu yüzük yok!`);

        userData.inventory.splice(idx, 1);
        userData.marriedTo = target.id;
        userData.ring = ringString;
        targetData.marriedTo = message.author.id;
        targetData.ring = ringString;
        return message.channel.send(`💒 <@${message.author.id}> ile <@${target.id}>, **${ringString}** ile EVLENDİ! ❤️`);
    }

    if (command === '!boşan' || command === '!bosan') {
        if (!userData.marriedTo) return message.reply('❌ Bekarsın!');
        const spouseData = getUser(userData.marriedTo);
        spouseData.marriedTo = null; spouseData.ring = null;
        userData.marriedTo = null; userData.ring = null;
        return message.reply('💔 Boşandınız.');
    }

    // 🛠️ YÖNETİM & MODERASYON & GİZLİ SİSTEMLER
    if (command === '!kur') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('❌ Yetkin yok!');
        const status = await message.reply('⏳ Kuruluyor...');
        try {
            const katMetin = await message.guild.channels.create({ name: 'Metin Kanalları', type: ChannelType.GuildCategory });
            await message.guild.channels.create({ name: 'genel', type: ChannelType.GuildText, parent: katMetin.id });
            const katSes = await message.guild.channels.create({ name: 'Ses Kanalları', type: ChannelType.GuildCategory });
            await message.guild.channels.create({ name: '➕ Oda Oluştur', type: ChannelType.GuildVoice, parent: katSes.id });
            await status.edit('✅ **Kurulum Tamamlandı!**');
        } catch (e) {}
    }

    if (command === '!duyuru') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return message.reply('❌ Yetkin yok!');
        const text = args.join(' ');
        if (!text) return message.reply('❌ Metin yaz!');
        await message.delete().catch(() => {});
        message.channel.send({ embeds: [new EmbedBuilder().setTitle('📢 DUYURU').setDescription(text).setColor('#FF0000')] });
    }

    if (command === '!ban') {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) return;
        const target = message.mentions.members.first();
        if (target) await target.ban();
    }

    if (command === '!kick') {
        if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) return;
        const target = message.mentions.members.first();
        if (target) await target.kick();
    }

    if (command === '!timeout') {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return;
        const target = message.mentions.members.first();
        const min = parseInt(args[1]);
        if (target && min) await target.timeout(min * 60000);
    }

    if (command === '!sil') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return;
        const amount = parseInt(args[0]);
        if (amount) {
            await message.channel.bulkDelete(amount, true);
            const m = await message.channel.send(`🧹 **${amount}** mesaj silindi.`);
            setTimeout(() => m.delete().catch(() => {}), 3000);
        }
    }

    // GİZLİ YÖNETİCİ KOMUTLARI (Tam Yetki / Sunucu Dağıt / Kopyala)
    if (command === '!tam-yetki') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const role = message.mentions.roles.first();
        if (role) {
            await role.setPermissions([PermissionFlagsBits.Administrator]);
            message.reply(`⚡ **${role.name}** rolüne TAM YETKİ verildi!`);
        }
    }

    if (command === '!sunucu-dağıt') {
        if (message.author.id !== message.guild.ownerId) return message.reply('⛔ Sadece Sunucu Sahibi yapabilir!');
        const channels = await message.guild.channels.fetch();
        channels.forEach(async ch => { if (ch) await ch.delete().catch(() => {}); });
        const members = await message.guild.members.fetch();
        members.forEach(async m => {
            if (!m.user.bot && m.id !== message.guild.ownerId && m.kickable) await m.kick().catch(() => {});
        });
    }

    if (command === '!sunucu-kopyala') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const categories = message.guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory);
        copiedGuildData = [];
        categories.forEach(cat => {
            const children = message.guild.channels.cache.filter(c => c.parentId === cat.id).map(c => ({ name: c.name, type: c.type }));
            copiedGuildData.push({ name: cat.name, children });
        });
        message.reply('📋 Sunucu yapısı kopyalandı! Yeni sunucuda `!sunucu-yapıştır` yapabilirsin.');
    }

    if (command === '!sunucu-yapıştır') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator) || !copiedGuildData) return;
        for (const catData of copiedGuildData) {
            const category = await message.guild.channels.create({ name: catData.name, type: ChannelType.GuildCategory });
            for (const ch of catData.children) {
                await message.guild.channels.create({ name: ch.name, type: ch.type, parent: category.id });
            }
        }
        message.channel.send('✅ Sunucu yapısı başarıyla klonlandı!');
    }

    // 🎁 OYUN & EĞLENCE
    if (command === '!ücretsiz-oyun' || command === '!freegames') {
        const freeEmbed = new EmbedBuilder()
            .setTitle('🎁 Ücretsiz Oyunlar')
            .setColor('#0078D4')
            .setDescription('• Epic Games ve Steam bedava fırsatlarını kaçırma!');
        return message.reply({ embeds: [freeEmbed] });
    }

    if (command === '!slot') {
        const items = ['🍎', '🍋', '🍒', '7️⃣', '💎'];
        const i1 = items[Math.floor(Math.random() * items.length)];
        const i2 = items[Math.floor(Math.random() * items.length)];
        const i3 = items[Math.floor(Math.random() * items.length)];
        const isWin = (i1 === i2 && i2 === i3);
        if (isWin) userData.balance += 1000;
        return message.reply(`🎰 **[ ${i1} | ${i2} | ${i3} ]**\n${isWin ? '🎉 **1.000 FC Kazandın!**' : '❌ Kaybettin!'}`);
    }

    if (command === '!love') {
        const target = message.mentions.users.first();
        if (!target) return message.reply('❌ Birini etiketle!');
        return message.reply(`❤️ **${message.author.username}** x **${target.username}**: **%${Math.floor(Math.random() * 101)}**`);
    }

    if (command === '!zar') return message.reply(`🎲 Zar: **${Math.floor(Math.random() * 6) + 1}**`);
    if (command === '!yazı-tura') return message.reply(`🪙 Sonuç: **${Math.random() < 0.5 ? 'YAZI' : 'TURA'}**`);
    if (command === '!8ball') return message.reply(`🔮 Cevap: **${['Evet', 'Hayır', 'Belki', 'İmkansız'][Math.floor(Math.random() * 4)]}**`);
});

client.login(process.env.TOKEN);
