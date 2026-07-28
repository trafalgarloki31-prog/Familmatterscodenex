require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    ChannelType, 
    PermissionFlagsBits, 
    EmbedBuilder 
} = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');
const http = require('http');

// Render / UptimeRobot mini web sunucusu
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.write("Bot 7/24 Aktif!");
    res.end();
}).listen(process.env.PORT || 3000, () => {
    console.log("🌐 Web sunucusu Render portunda dinlemede.");
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// -------------------------------------------------------------
// 💾 VERİTABANI & SAKLAMA (BELLEK İÇİ)
// -------------------------------------------------------------
const db = {
    users: {}
};

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

// Temp Voice (Geçici Oda) takip kümesi
const tempChannels = new Set();

client.once('ready', () => {
    console.log(`🤖 ${client.user.tag} olarak başarıyla giriş yapıldı!`);
});

// -------------------------------------------------------------
// ➕ GEÇİCİ SES ODASI SİSTEMİ (JOIN TO CREATE)
// -------------------------------------------------------------
client.on('voiceStateUpdate', async (oldState, newState) => {
    if (newState.channel && newState.channel.name.includes('➕ Oda Oluştur')) {
        const guild = newState.guild;
        const user = newState.member.user;

        try {
            const createdChannel = await guild.channels.create({
                name: `🔊 ${user.username}'in Odası`,
                type: ChannelType.GuildVoice,
                parent: newState.channel.parentId || null
            });

            await newState.setChannel(createdChannel);
            tempChannels.add(createdChannel.id);
        } catch (err) {
            console.error("Geçici oda hatası:", err);
        }
    }

    if (oldState.channel && tempChannels.has(oldState.channel.id)) {
        if (oldState.channel.members.size === 0) {
            try {
                tempChannels.delete(oldState.channel.id);
                await oldState.channel.delete();
            } catch (err) {
                console.error("Oda silme hatası:", err);
            }
        }
    }
});

// -------------------------------------------------------------
// 💬 MESAJ & KOMUT MANTIĞI
// -------------------------------------------------------------
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const userData = getUser(message.author.id);

    // MESAJ BAŞI XP & LEVEL
    userData.xp += Math.floor(Math.random() * 10) + 5;
    const nextLevelXp = userData.level * 100;
    if (userData.xp >= nextLevelXp) {
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

    // -------------------------------------------------------------
    // 🎙️ KOMUTLA 7/24 SESE GİRME & ÇIKMA KOMUTLARI
    // -------------------------------------------------------------
    if (command === '!katıl' || command === '!katil' || command === '!join') {
        const voiceChannel = message.member.voice.channel;

        if (!voiceChannel) {
            return message.reply('❌ Önce bir ses kanalına girmelisin kanka!');
        }

        try {
            joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
                selfDeaf: true,
                selfMute: false
            });

            return message.reply(`🔊 **${voiceChannel.name}** kanalına katıldım! Artık 7/24 buradayım.`);
        } catch (error) {
            console.error(error);
            return message.reply('❌ Ses kanalına katılırken bir sorun oluştu!');
        }
    }

    if (command === '!ayrıl' || command === '!ayril' || command === '!leave') {
        const connection = getVoiceConnection(message.guild.id);

        if (!connection) {
            return message.reply('❌ Zaten herhangi bir ses kanalında değilim kanka!');
        }

        connection.destroy();
        return message.reply('👋 Ses kanalından ayrıldım.');
    }

    // -------------------------------------------------------------
    // 📖 HER ŞEYİ İÇEREN YARDIM MENÜSÜ (!yardım)
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
                    value: '`!ücretsiz-oyun` • Bedava oyunları gösterir.\n`!slot` • Slot oynatır.\n`!love @kullanıcı` • Aşk ölçer.\n`!zar` • `!yazı-tura` • `!8ball`.' 
                }
            )
            .setFooter({ text: `${message.guild.name} • Sistem rehberi` });

        return message.reply({ embeds: [helpEmbed] });
    }

    // -------------------------------------------------------------
    // 💼 EKONOMİ & EVLİLİK KOMUTLARI
    // -------------------------------------------------------------
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
                { name: '🎒 Envanterdeki Yüzükler', value: invText, inline: false }
            );

        return message.reply({ embeds: [profileEmbed] });
    }

    if (command === '!işler' || command === '!isler') {
        const jobsEmbed = new EmbedBuilder()
            .setTitle('💼 Mevcut Meslekler')
            .setColor('#3498DB')
            .setDescription('İşe girmek için: `!iş-gir <meslek_adı>`')
            .addFields(
                { name: '🛠️ Sanayi', value: 'Gereksinim: **Level 1**\nGünlük: **500 FC** | Aylık: **5.000 FC**', inline: false },
                { name: '👟 Sahte Ayakkabıcı', value: 'Gereksinim: **Level 10**\nGünlük: **1.500 FC** | Aylık: **15.000 FC**', inline: false },
                { name: '👠 Eskort', value: 'Gereksinim: **Level 20**\nGünlük: **3.500 FC** | Aylık: **35.000 FC**', inline: false },
                { name: '💻 Yazılımcı', value: 'Gereksinim: **Level 30**\nGünlük: **7.500 FC** | Aylık: **75.000 FC**', inline: false }
            );

        return message.reply({ embeds: [jobsEmbed] });
    }

    if (command === '!iş-gir' || command === '!is-gir') {
        const jobQuery = args.join(' ').toLowerCase();
        const selectedJob = JOBS[jobQuery];

        if (!selectedJob) return message.reply('❌ Geçersiz meslek! Listeye bak: `!işler`');
        if (userData.level < selectedJob.minLevel) return message.reply(`❌ Bu iş için **Level ${selectedJob.minLevel}** olmalısın!`);

        userData.job = selectedJob.name;
        return message.reply(`🎉 Artık **${selectedJob.name}** olarak çalışıyorsun.`);
    }

    if (command === '!günlük' || command === '!gunluk') {
        const now = Date.now();
        if (now - userData.lastDaily < 86400000) {
            const remHours = Math.ceil((86400000 - (now - userData.lastDaily)) / 3600000);
            return message.reply(`⏳ Günlük maaşını aldın! **${remHours} saat** sonra tekrar gel.`);
        }
        const currentJobKey = Object.keys(JOBS).find(k => JOBS[k].name === userData.job) || 'sanayi';
        const salary = JOBS[currentJobKey].daily;

        userData.balance += salary;
        userData.lastDaily = now;
        return message.reply(`💵 **${userData.job}** mesleğinden **${salary.toLocaleString()} Fam Coin** maaşını aldın!`);
    }

    if (command === '!aylık' || command === '!aylik') {
        const now = Date.now();
        if (now - userData.lastMonthly < 2592000000) {
            const remDays = Math.ceil((2592000000 - (now - userData.lastMonthly)) / 86400000);
            return message.reply(`⏳ Aylık maaşını aldın! **${remDays} gün** sonra tekrar gel.`);
        }
        const currentJobKey = Object.keys(JOBS).find(k => JOBS[k].name === userData.job) || 'sanayi';
        const salary = JOBS[currentJobKey].monthly;

        userData.balance += salary;
        userData.lastMonthly = now;
        return message.reply(`💰 **${userData.job}** mesleğinden **${salary.toLocaleString()} Fam Coin** maaşını aldın!`);
    }

    if (command === '!market' || command === '!yüzükler') {
        const marketEmbed = new EmbedBuilder()
            .setTitle('🏪 Yüzük Mağazası')
            .setColor('#E91E63')
            .addFields(
                { name: '🥉 Tahta Yüzük', value: '500 Fam Coin', inline: true },
                { name: '🥈 Gümüş Yüzük', value: '2.500 Fam Coin', inline: true },
                { name: '💍 Pırlanta Yüzük', value: '10.000 Fam Coin', inline: true },
                { name: '👑 Kral Yüzüğü', value: '50.000 Fam Coin', inline: true }
            );

        return message.reply({ embeds: [marketEmbed] });
    }

    if (command === '!satınal' || command === '!satinal') {
        const ringKey = args[0]?.toLowerCase();
        const ring = RINGS[ringKey];
        if (!ring) return message.reply('❌ Geçersiz yüzük! Örn: `!satınal tahta`');
        if (userData.balance < ring.price) return message.reply('❌ Bakiyen yetersiz!');

        userData.balance -= ring.price;
        userData.inventory.push(`${ring.emoji} ${ring.name}`);
        return message.reply(`🛍️ **${ring.emoji} ${ring.name}** satın aldın!`);
    }

    if (command === '!evlen') {
        const target = message.mentions.users.first();
        const ringKey = args[1]?.toLowerCase();
        if (!target || target.id === message.author.id || target.bot) return message.reply('❌ Geçersiz kişi!');
        if (userData.marriedTo) return message.reply('❌ Zaten evlisin!');

        const targetData = getUser(target.id);
        if (targetData.marriedTo) return message.reply('❌ Etiketlediğin kişi zaten evli!');

        const ring = RINGS[ringKey];
        if (!ring) return message.reply('❌ Teklif için yüzük belirt! Örn: `!evlen @kullanıcı tahta`');

        const ringString = `${ring.emoji} ${ring.name}`;
        const ringIndex = userData.inventory.indexOf(ringString);

        if (ringIndex === -1) return message.reply(`❌ Envanterinde **${ring.name}** yok!`);

        userData.inventory.splice(ringIndex, 1);
        userData.marriedTo = target.id;
        userData.ring = ringString;
        targetData.marriedTo = message.author.id;
        targetData.ring = ringString;

        return message.channel.send(`💒 🎉 **TEBRİKLER!** <@${message.author.id}> ile <@${target.id}>, **${ringString}** ile EVLENDİ! ❤️`);
    }

    if (command === '!boşan' || command === '!bosan') {
        if (!userData.marriedTo) return message.reply('❌ Bekarsın!');
        const spouseId = userData.marriedTo;
        const spouseData = getUser(spouseId);

        userData.marriedTo = null;
        userData.ring = null;
        spouseData.marriedTo = null;
        spouseData.ring = null;

        return message.reply(`💔 <@${spouseId}> ile boşandınız!`);
    }

    if (command === '!transfer') {
        const target = message.mentions.users.first();
        const amount = parseInt(args[1]);
        if (!target || isNaN(amount) || amount <= 0) return message.reply('❌ Doğru kullanım: `!transfer @kullanıcı <miktar>`');
        if (userData.balance < amount) return message.reply('❌ Bakiyen yetersiz!');

        const targetData = getUser(target.id);
        userData.balance -= amount;
        targetData.balance += amount;
        return message.reply(`💸 <@${target.id}> kişisine **${amount.toLocaleString()} FC** gönderdin!`);
    }

    // -------------------------------------------------------------
    // 🎁 DİĞER DİĞER KOMUTLAR (ÜCRETSİZ OYUN, MODERASYON, EĞLENCE)
    // -------------------------------------------------------------
    if (command === '!ücretsiz-oyun' || command === '!freegames') {
        const freeGamesEmbed = new EmbedBuilder()
            .setTitle('🎁 Ücretsiz Oyun Fırsatları')
            .setColor('#0078D4')
            .addFields(
                { name: '🎮 Epic Games Store', value: '• Haftalık bedava oyunları kaçırma!\n🔗 [Epic Games Store](https://store.epicgames.com/)', inline: false },
                { name: '💨 Steam', value: '• Kısa süreli bedava oyun fırsatları!\n🔗 [Steam Mağazası](https://store.steampowered.com/)', inline: false }
            );

        return message.reply({ embeds: [freeGamesEmbed] });
    }

    if (command === '!kur') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply('❌ Yönetsel yetki gerekli!');
        const guild = message.guild;
        const statusMsg = await message.reply('⏳ Sunucu kuruluyor...');

        try {
            await guild.channels.create({ name: 'rules', type: ChannelType.GuildText });
            await guild.channels.create({ name: 'hoş-geldiniz😁boost', type: ChannelType.GuildText });
            await guild.channels.create({ name: '📣duyuru📣', type: ChannelType.GuildText });

            const katMetin = await guild.channels.create({ name: 'Metin Kanalları', type: ChannelType.GuildCategory });
            await guild.channels.create({ name: 'genel', type: ChannelType.GuildText, parent: katMetin.id });
            await guild.channels.create({ name: 'bot-komut', type: ChannelType.GuildText, parent: katMetin.id });

            const katSes = await guild.channels.create({ name: 'Ses Kanalları', type: ChannelType.GuildCategory });
            await guild.channels.create({ name: '➕ Oda Oluştur', type: ChannelType.GuildVoice, parent: katSes.id });
            await guild.channels.create({ name: 'Sohbet - 1', type: ChannelType.GuildVoice, parent: katSes.id });

            await statusMsg.edit('✅ **Kurulum tamamlandı!**');
        } catch (e) {
            console.error(e);
        }
    }

    if (command === '!duyuru') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return message.reply('❌ Yetkin yok!');
        const text = args.join(' ');
        if (!text) return message.reply('❌ Metin yaz!');
        await message.delete().catch(() => {});
        const embed = new EmbedBuilder().setTitle('📢 DUYURU').setDescription(text).setColor('#FF0000');
        message.channel.send({ embeds: [embed] });
    }

    if (command === '!sil' || command === '!clear') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return message.reply('❌ Yetkin yok!');
        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount < 1 || amount > 100) return message.reply('❌ 1-100 arası miktar gir!');
        await message.channel.bulkDelete(amount, true);
        const m = await message.channel.send(`🧹 **${amount}** mesaj silindi.`);
        setTimeout(() => m.delete().catch(() => {}), 3000);
    }

    if (command === '!slot') {
        const items = ['🍎', '🍋', '🍒', '7️⃣', '💎'];
        const i1 = items[Math.floor(Math.random() * items.length)];
        const i2 = items[Math.floor(Math.random() * items.length)];
        const i3 = items[Math.floor(Math.random() * items.length)];
        const isWin = (i1 === i2 && i2 === i3);
        if (isWin) userData.balance += 1000;

        const slotEmbed = new EmbedBuilder()
            .setTitle('🎰 Slot')
            .setDescription(`**[ ${i1} | ${i2} | ${i3} ]**\n\n${isWin ? '🎉 **1.000 FC Kazandın!**' : '❌ Kaybettin!'}`)
            .setColor(isWin ? '#2ECC71' : '#E74C3C');

        return message.reply({ embeds: [slotEmbed] });
    }

    if (command === '!love') {
        const target = message.mentions.users.first();
        if (!target) return message.reply('❌ Birini etiketle!');
        const lovePercent = Math.floor(Math.random() * 101);
        return message.reply(`❤️ **${message.author.username}** x **${target.username}**: **%${lovePercent}**`);
    }

    if (command === '!zar') return message.reply(`🎲 Zar: **${Math.floor(Math.random() * 6) + 1}**`);
    if (command === '!yazı-tura') return message.reply(`🪙 Sonuç: **${Math.random() < 0.5 ? 'YAZI' : 'TURA'}**`);
    if (command === '!ping') return message.reply(`🏓 Ping: **${client.ws.ping}ms**`);
});

client.login(process.env.TOKEN);
