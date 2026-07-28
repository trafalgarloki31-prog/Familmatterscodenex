require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
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
        GatewayIntentBits.MessageContent
    ]
});

// -------------------------------------------------------------
// 💾 VERİTABANI (BELLEK İÇİ)
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

client.once('ready', () => {
    console.log(`🤖 ${client.user.tag} olarak başarıyla giriş yapıldı!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const userData = getUser(message.author.id);

    // -------------------------------------------------------------
    // 📈 MESAJ BAŞI XP & LEVEL
    // -------------------------------------------------------------
    userData.xp += Math.floor(Math.random() * 10) + 5;
    const nextLevelXp = userData.level * 100;
    if (userData.xp >= nextLevelXp) {
        userData.level += 1;
        userData.xp = 0;
        message.channel.send(`🎉 Tebrikler <@${message.author.id}>! **Level ${userData.level}** oldun!`).catch(() => {});
    }

    const lowerText = message.content.toLowerCase().trim();

    // OTOMATİK SA-AS
    if (['sa', 'sea', 'selam', 'selamunaleykum', 'selamın aleyküm'].includes(lowerText)) {
        return message.reply(`Aleykümselam **${message.author.username}**, hoş geldin! 👋`);
    }

    const args = message.content.trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // -------------------------------------------------------------
    // 📖 HEPSİNİ İÇEREN TAM YARDIM MENÜSÜ (!yardım)
    // -------------------------------------------------------------
    if (command === '!yardım' || command === '!help') {
        const helpEmbed = new EmbedBuilder()
            .setTitle('🤖 Bot Komut Listesi')
            .setColor('#7289DA')
            .setDescription('Aşağıda kullanabileceğin tüm komutlar kategorilerine göre listelenmiştir:')
            .addFields(
                { 
                    name: '🛠️ Yönetim & Moderasyon', 
                    value: '`!kur` • Sunucuyu kurar.\n`!duyuru <mesaj>` • Duyuru yapar.\n`!ban @kullanıcı` • Banlar.\n`!kick @kullanıcı` • Atar.\n`!timeout @kullanıcı <dk>` • Susturur.\n`!sil <miktar>` • Mesajları siler.\n`!yavaş-mod <sn>` • Yavaş modu ayarlar.' 
                },
                { 
                    name: '💼 Ekonomi & İşler', 
                    value: '`!profil` • Kartını gösterir.\n`!işler` • Meslekleri gösterir.\n`!iş-gir <meslek>` • İşe girer.\n`!günlük` • Günlük maaş alır.\n`!aylık` • Aylık maaş alır.\n`!transfer @kullanıcı <miktar>` • Para gönderir.' 
                },
                { 
                    name: '💍 Evlilik & Mağaza', 
                    value: '`!market` • Yüzükleri gösterir.\n`!satınal <yüzük>` • Yüzük alır.\n`!evlen @kullanıcı <yüzük>` • Evlenir.\n`!boşan` • Boşanır.' 
                },
                { 
                    name: '📊 Bilgi & Genel', 
                    value: '`!sunucu` • İstatistikler.\n`!kullanıcı [@kullanıcı]` • Profil detayı.\n`!avatar [@kullanıcı]` • HD Avatar.\n`!ping` • Bot gecikmesi.' 
                },
                { 
                    name: '🎲 Eğlence & Oyunlar', 
                    value: '`!slot` • Slot oynatır.\n`!love @kullanıcı` • Aşk ölçer.\n`!zar` • Zar atar.\n`!yazı-tura` • Parayı fırlatır.\n`!8ball <soru>` • Soru cevaplar.' 
                }
            )
            .setFooter({ text: `${message.guild.name} • Yardım Sistemi` });

        return message.reply({ embeds: [helpEmbed] });
    }

    // -------------------------------------------------------------
    // 🛠️ SUNUCU KURULUMU (!kur)
    // -------------------------------------------------------------
    if (command === '!kur') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Bu komutu sadece **Yöneticiler** kullanabilir!');
        }

        const guild = message.guild;
        const statusMsg = await message.reply('⏳ Odalar ve kategoriler kuruluyor kanka, biraz bekle...');

        try {
            await guild.channels.create({ name: 'rules', type: ChannelType.GuildText });
            await guild.channels.create({ name: 'hoş-geldiniz😁boost', type: ChannelType.GuildText });
            await guild.channels.create({ name: '📣duyuru📣', type: ChannelType.GuildText });
            await guild.channels.create({ name: '🎉giveaway🎉', type: ChannelType.GuildText });

            const katKanalizasyon = await guild.channels.create({ name: 'KANALİZASYON', type: ChannelType.GuildCategory });
            await guild.channels.create({ name: 'GÖREV', type: ChannelType.GuildVoice, parent: katKanalizasyon.id });

            const katMetin = await guild.channels.create({ name: 'Metin Kanalları', type: ChannelType.GuildCategory });
            await guild.channels.create({ name: 'genel', type: ChannelType.GuildText, parent: katMetin.id });
            await guild.channels.create({ name: '📷media📷', type: ChannelType.GuildText, parent: katMetin.id });
            await guild.channels.create({ name: 'rust-wipe', type: ChannelType.GuildText, parent: katMetin.id });
            await guild.channels.create({ name: 'media-araç-özel', type: ChannelType.GuildText, parent: katMetin.id });
            await guild.channels.create({ name: 'bot-komut', type: ChannelType.GuildText, parent: katMetin.id });

            const katSes = await guild.channels.create({ name: 'Ses Kanalları', type: ChannelType.GuildCategory });
            await guild.channels.create({ name: 'seviye', type: ChannelType.GuildText, parent: katSes.id });
            await guild.channels.create({ name: 'FALLİNG MY LOVEEEEEEEEE', type: ChannelType.GuildVoice, parent: katSes.id });
            await guild.channels.create({ name: '｡˚🎄 ✩ ₊˚🦌 ⊹♡', type: ChannelType.GuildVoice, parent: katSes.id });
            await guild.channels.create({ name: 'koding', type: ChannelType.GuildVoice, parent: katSes.id });
            await guild.channels.create({ name: 'GNGxSAVANNA', type: ChannelType.GuildVoice, parent: katSes.id });

            const katPavyon = await guild.channels.create({ name: 'PAVYONNNN', type: ChannelType.GuildCategory });
            await guild.channels.create({ name: 'kerhaneci-killaaaa', type: ChannelType.GuildText, parent: katPavyon.id });
            await guild.channels.create({ name: 'DUYURU', type: ChannelType.GuildVoice, parent: katPavyon.id });

            await statusMsg.edit('✅ **Tüm odalar ve kategoriler eksiksiz kuruldu kanka!**');
        } catch (error) {
            console.error(error);
            await statusMsg.edit('❌ Kurulum sırasında bir hata oluştu. Botun "Yönetici" yetkisi olduğundan emin ol.');
        }
    }

    // 📢 EMBED DUYURU
    if (command === '!duyuru') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return message.reply('❌ Yetkin yok!');
        }
        const duyuruMetni = args.join(' ');
        if (!duyuruMetni) return message.reply('❌ Lütfen duyuru metnini yaz!');

        await message.delete().catch(() => {});

        const duyuruEmbed = new EmbedBuilder()
            .setTitle('📢 SUNUCU DUYURUSU')
            .setDescription(duyuruMetni)
            .setColor('#FF0000')
            .setFooter({ text: `Duyuruyu Yapan: ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
            .setTimestamp();

        message.channel.send({ embeds: [duyuruEmbed] });
    }

    // ⏳ YAVAŞ MOD
    if (command === '!yavaş-mod' || command === '!yavasmod' || command === '!slowmode') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return message.reply('❌ Yetkin yok!');
        }
        const seconds = parseInt(args[0]);
        if (isNaN(seconds) || seconds < 0 || seconds > 21600) return message.reply('❌ 0-21600 arası sayı gir!');

        try {
            await message.channel.setRateLimitPerUser(seconds);
            message.reply(seconds === 0 ? '✅ Yavaş mod kaldırıldı.' : `⏳ Yavaş mod **${seconds} saniye** ayarlandı.`);
        } catch (error) {
            console.error(error);
        }
    }

    // 👤 PROFİL (EKONOMİ DAHİL)
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

    // 💼 İŞLER & MESLEKLER
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

    // 💵 GÜNLÜK & AYLIK
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
        return message.reply(`💰 **${userData.job}** mesleğinden **${salary.toLocaleString()} Fam Coin** dev maaşını aldın!`);
    }

    // 🏪 MARKET & EVLİLİK
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
        if (userData.balance < ring.price) return message.reply('❌ Yetersiz bakiye!');

        userData.balance -= ring.price;
        userData.inventory.push(`${ring.emoji} ${ring.name}`);
        return message.reply(`🛍️ **${ring.emoji} ${ring.name}** satın alındı!`);
    }

    if (command === '!evlen') {
        const target = message.mentions.users.first();
        const ringKey = args[1]?.toLowerCase();
        if (!target || target.id === message.author.id || target.bot) return message.reply('❌ Geçersiz kişi!');
        if (userData.marriedTo) return message.reply('❌ Zaten evlisin!');
        
        const targetData = getUser(target.id);
        if (targetData.marriedTo) return message.reply('❌ Etiketlediğin kişi evli!');

        const ring = RINGS[ringKey];
        if (!ring) return message.reply('❌ Örn: `!evlen @kullanıcı tahta`');

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
        if (!userData.marriedTo) return message.reply('❌ Zaten bekarsın!');
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
        if (!target || isNaN(amount) || amount <= 0) return message.reply('❌ Kullanım: `!transfer @kullanıcı <miktar>`');
        if (userData.balance < amount) return message.reply('❌ Bakiyen yetersiz!');

        const targetData = getUser(target.id);
        userData.balance -= amount;
        targetData.balance += amount;
        return message.reply(`💸 <@${target.id}> kişisine **${amount.toLocaleString()} FC** aktarıldı!`);
    }

    // 👤 KULLANICI DETAYI & BİLGİ
    if (command === '!kullanıcı' || command === '!user') {
        const targetMember = message.mentions.members.first() || message.member;
        const user = targetMember.user;

        const userEmbed = new EmbedBuilder()
            .setTitle(`👤 ${user.username} Bilgileri`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .setColor('#3498DB')
            .addFields(
                { name: '🆔 ID', value: user.id, inline: true },
                { name: '🏷️ Tag', value: user.tag, inline: true },
                { name: '📅 Discord Katılım', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`, inline: false },
                { name: '🏰 Sunucu Katılım', value: `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:F>`, inline: false }
            );

        return message.reply({ embeds: [userEmbed] });
    }

    if (command === '!avatar') {
        const targetUser = message.mentions.users.first() || message.author;
        const avatarEmbed = new EmbedBuilder()
            .setTitle(`🖼️ ${targetUser.username} Profil Fotoğrafı`)
            .setImage(targetUser.displayAvatarURL({ dynamic: true, size: 1024 }))
            .setColor('#5865F2');
        return message.reply({ embeds: [avatarEmbed] });
    }

    if (command === '!sunucu') {
        const guild = message.guild;
        const serverEmbed = new EmbedBuilder()
            .setTitle(`🏰 ${guild.name} Sunucu Bilgileri`)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .setColor('#57F287')
            .addFields(
                { name: '👥 Üye Sayısı', value: `${guild.memberCount}`, inline: true },
                { name: '👑 Sahibi', value: `<@${guild.ownerId}>`, inline: true },
                { name: '📅 Kuruluş', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true }
            );
        return message.reply({ embeds: [serverEmbed] });
    }

    if (command === '!ping') {
        return message.reply(`🏓 Pong! **${client.ws.ping}ms**`);
    }

    // 🎲 EĞLENCE KOMUTLARI
    if (command === '!slot') {
        const slotItems = ['🍎', '🍋', '🍒', '7️⃣', '💎'];
        const item1 = slotItems[Math.floor(Math.random() * slotItems.length)];
        const item2 = slotItems[Math.floor(Math.random() * slotItems.length)];
        const item3 = slotItems[Math.floor(Math.random() * slotItems.length)];

        let winAmount = 0;
        let resultText = '❌ Kaybettin!';

        if (item1 === item2 && item2 === item3) {
            winAmount = 1000;
            resultText = '🎉 **JACKPOT! 1.000 Fam Coin KAZANDIN!**';
        } else if (item1 === item2 || item2 === item3 || item1 === item3) {
            winAmount = 250;
            resultText = '✨ 2 Eşleşme! **250 Fam Coin** kazandın.';
        }

        userData.balance += winAmount;

        const slotEmbed = new EmbedBuilder()
            .setTitle('🎰 Slot Makinesi')
            .setDescription(`**[ ${item1} | ${item2} | ${item3} ]**\n\n${resultText}`)
            .setColor('#F1C40F');

        return message.reply({ embeds: [slotEmbed] });
    }

    if (command === '!love' || command === '!ship') {
        const target = message.mentions.users.first();
        if (!target) return message.reply('❌ Birini etiketle!');

        const lovePercent = Math.floor(Math.random() * 101);
        let loveBar = '💖'.repeat(Math.floor(lovePercent / 10)) + '🖤'.repeat(10 - Math.floor(lovePercent / 10));

        const loveEmbed = new EmbedBuilder()
            .setTitle('❤️ Aşk & Uyum Ölçer')
            .setDescription(`**${message.author.username}** ile **${target.username}**:\n\n**%${lovePercent}**\n[ ${loveBar} ]`)
            .setColor('#E91E63');

        return message.reply({ embeds: [loveEmbed] });
    }

    if (command === '!zar') {
        return message.reply(`🎲 Zarı attın: **${Math.floor(Math.random() * 6) + 1}**`);
    }

    if (command === '!yazı-tura' || command === '!yazitura') {
        return message.reply(`Parayı attın... Sonuç: **${Math.random() < 0.5 ? 'YAZI 🪙' : 'TURA 🪙'}**`);
    }

    if (command === '!8ball') {
        const soru = args.join(' ');
        if (!soru) return message.reply('❌ Soru sor!');
        const cevaplar = ['Kesinlikle evet! 🔥', 'Buna şüphen olmasın. 😎', 'Şu an kestiremiyorum 🤔', 'Pek sanmıyorum kanka...', 'İmkansız! ❌'];
        return message.reply(`🔮 **Soru:** ${soru}\n💬 **Cevap:** ${cevaplar[Math.floor(Math.random() * cevaplar.length)]}`);
    }

    // 🔨 MODERASYON (BAN, KICK, TIMEOUT, SIL)
    if (command === '!ban') {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) return message.reply('❌ Yetkin yok!');
        const targetMember = message.mentions.members.first();
        const reason = args.slice(1).join(' ') || 'Sebep belirtilmedi.';
        if (!targetMember || !targetMember.bannable) return message.reply('❌ Kullanıcı banlanamıyor!');

        try {
            await targetMember.ban({ reason });
            message.reply(`🚨 **${targetMember.user.tag}** yasaklandı! **Sebep:** ${reason}`);
        } catch (error) {
            console.error(error);
        }
    }

    if (command === '!kick') {
        if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) return message.reply('❌ Yetkin yok!');
        const targetMember = message.mentions.members.first();
        const reason = args.slice(1).join(' ') || 'Sebep belirtilmedi.';
        if (!targetMember || !targetMember.kickable) return message.reply('❌ Kullanıcı atılamıyor!');

        try {
            await targetMember.kick(reason);
            message.reply(`👞 **${targetMember.user.tag}** atıldı! **Sebep:** ${reason}`);
        } catch (error) {
            console.error(error);
        }
    }

    if (command === '!timeout' || command === '!sustur') {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return message.reply('❌ Yetkin yok!');
        const targetMember = message.mentions.members.first();
        const minutes = parseInt(args[1]);
        const reason = args.slice(2).join(' ') || 'Sebep belirtilmedi.';
        if (!targetMember || isNaN(minutes) || !targetMember.moderatable) return message.reply('❌ Geçersiz kullanım!');

        try {
            await targetMember.timeout(minutes * 60 * 1000, reason);
            message.reply(`⏱️ **${targetMember.user.tag}** **${minutes} dakika** susturuldu!`);
        } catch (error) {
            console.error(error);
        }
    }

    if (command === '!sil' || command === '!clear') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return message.reply('❌ Yetkin yok!');
        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount < 1 || amount > 100) return message.reply('❌ 1-100 arası miktar gir!');

        try {
            await message.channel.bulkDelete(amount, true);
            const noticeMsg = await message.channel.send(`🧹 **${amount}** mesaj temizlendi!`);
            setTimeout(() => noticeMsg.delete().catch(() => {}), 3000);
        } catch (error) {
            console.error(error);
        }
    }
});

client.login(process.env.TOKEN);
