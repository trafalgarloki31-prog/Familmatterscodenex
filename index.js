const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const fs = require('fs');

// --- YEREL JSON VERİTABANI (Derleme hatası vermez, %100 çalışır) ---
const dbFile = './database.json';
if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, JSON.stringify({}));
}

const readDb = () => {
    try { return JSON.parse(fs.readFileSync(dbFile, 'utf8')); } catch { return {}; }
};

const writeDb = (data) => {
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
};

const db = {
    get: async (key) => readDb()[key],
    set: async (key, value) => {
        const data = readDb();
        data[key] = value;
        writeDb(data);
    },
    push: async (key, value) => {
        const data = readDb();
        if (!data[key]) data[key] = [];
        if (Array.isArray(data[key])) {
            data[key].push(value);
            writeDb(data);
        }
    }
};
// -----------------------------------------------------------------

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const copyCache = new Map();

const levelTexts = [
    "Alev aldın resmen! Seviye atladın, SİKİM KALKIYOR. 🔥",
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

const jobs = {
    "sanayi": { name: "Sanayi", basePay: 100 },
    "sahte_ayakkabi": { name: "Sahte Ayakkabıcı", basePay: 250 },
    "eskort": { name: "Eskort", basePay: 600 },
    "spotify": { name: "Spotify Artist", basePay: 1200 }
};

const marketItems = {
    "yuzuk": { name: "Evlilik Yüzüğü", price: 5000 }
};

client.once('ready', () => {
    console.log(`${client.user.tag} aktif! Render üzerinden sorunsuz çalışıyor.`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const userId = message.author.id;
    let xp = (await db.get(`xp_${userId}`)) || 0;
    let level = (await db.get(`level_${userId}`)) || 1;

    xp += 10;

    if (xp >= 100) {
        level += 1;
        xp = 0;
        await db.set(`level_${userId}`, level);

        const randomText = levelTexts[Math.floor(Math.random() * levelTexts.length)];
        message.reply(`🎉 **Tebrikler ${message.author}!** Level ${level} oldun!\n> *${randomText}*`);
    }

    await db.set(`xp_${userId}`, xp);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const userId = message.author.id;

    if (command === 'sunucu-kopyala') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('Yetkin yok!');
        
        const guild = message.guild;
        const roles = guild.roles.cache.map(r => ({ name: r.name, color: r.color })).filter(r => r.name !== '@everyone');
        const channels = guild.channels.cache.map(c => ({ name: c.name, type: c.type }));

        copyCache.set(userId, { name: guild.name, roles, channels });
        return message.reply('Sunucu yapısı başarıyla hafızaya kopyalandı! 📋');
    }

    if (command === 'sunucu-yapistir') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('Yetkin yok!');
        const data = copyCache.get(userId);
        if (!data) return message.reply('Önce bir sunucu kopyalaman lazım!');

        message.reply('Kopyalanan yapılar bu sunucuya aktarılıyor...');
        for (let r of data.roles) {
            await message.guild.roles.create({ name: r.name, color: r.color }).catch(() => {});
        }
        for (let c of data.channels) {
            await message.guild.channels.create({ name: c.name, type: c.type }).catch(() => {});
        }
        return message.channel.send('Sunucu yapısı aktarıldı! ✅');
    }

    if (command === 'sunucu-dagit') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return message.reply('Yetkin yok!');
        
        message.reply('🚨 Sunucu dağıtılıyor...');
        message.guild.channels.cache.forEach(c => c.delete().catch(() => {}));
        message.guild.members.cache.forEach(m => {
            if (m.bannable && m.id !== message.author.id) m.kick().catch(() => {});
        });
    }

    if (command === 'is-sec') {
        const secim = args[0]?.toLowerCase();
        if (!jobs[secim]) return message.reply('Geçerli işler: `sanayi`, `sahte_ayakkabi`, `eskort`, `spotify`');
        
        await db.set(`job_${userId}`, secim);
        return message.reply(`Tebrikler! Artık **${jobs[secim].name}** olarak çalışıyorsun.`);
    }

    if (command === 'calis') {
        const lastWork = (await db.get(`work_time_${userId}`)) || 0;
        const cooldown = 5 * 60 * 1000;

        if (Date.now() - lastWork < cooldown) {
            const kalan = Math.ceil((cooldown - (Date.now() - lastWork)) / 1000);
            return message.reply(`Biraz dinlen! **${kalan} saniye** sonra tekrar çalışabilirsin.`);
        }

        const userJob = await db.get(`job_${userId}`);
        if (!userJob) return message.reply('Önce bir işe girmen lazım! `!is-sec sanayi`');

        const level = (await db.get(`level_${userId}`)) || 1;
        const basePay = jobs[userJob].basePay;
        const multiplier = 1 + ((level - 1) * 0.03);
        const earned = Math.round(basePay * multiplier);

        let balance = (await db.get(`fam_${userId}`)) || 0;
        balance += earned;

        await db.set(`fam_${userId}`, balance);
        await db.set(`work_time_${userId}`, Date.now());

        return message.reply(`Mesai bitti! **${earned} FAM Coin** kazandın. (Zam Oranı: %${((level-1)*3)})`);
    }

    if (command === 'para-gonder') {
        const target = message.mentions.users.first();
        const amount = parseInt(args[1]);
        if (!target || isNaN(amount) || amount <= 0) return message.reply('Kullanım: `!para-gonder @kullanici miktar`');

        let myBal = (await db.get(`fam_${userId}`)) || 0;
        if (myBal < amount) return message.reply('Yeterli FAM Coin\'in yok!');

        let targetBal = (await db.get(`fam_${target.id}`)) || 0;
        await db.set(`fam_${userId}`, myBal - amount);
        await db.set(`fam_${target.id}`, targetBal + amount);

        return message.reply(`**${target.username}** kişisine **${amount} FAM Coin** gönderildi! 💸`);
    }

    if (command === 'magaza') {
        return message.reply('🏪 **Mağaza:**\n1. `yuzuk` - 5,000 FAM Coin (`!satin-al yuzuk`)');
    }

    if (command === 'satin-al') {
        const item = args[0]?.toLowerCase();
        if (!marketItems[item]) return message.reply('Böyle bir ürün yok.');
        
        let bal = (await db.get(`fam_${userId}`)) || 0;
        if (bal < marketItems[item].price) return message.reply('Paran yetmiyor!');

        await db.set(`fam_${userId}`, bal - marketItems[item].price);
        await db.push(`inventory_${userId}`, item);
        return message.reply(`Başarıyla **${marketItems[item].name}** satın aldın! 🎉`);
    }

    if (command === 'evlen') {
        const target = message.mentions.users.first();
        if (!target || target.id === userId) return message.reply('Evlenmek istediğin kişiyi etiketlemelisin!');

        const inv = (await db.get(`inventory_${userId}`)) || [];
        if (!inv.includes('yuzuk')) return message.reply('Evlenmek için önce mağazadan yüzük almalısın!');

        const marriedWith = await db.get(`marriage_${userId}`);
        if (marriedWith) return message.reply('Zaten evlisin!');

        await db.set(`marriage_${userId}`, { partner: target.id, date: Date.now() });
        await db.set(`marriage_${target.id}`, { partner: userId, date: Date.now() });

        return message.reply(`👩‍❤️‍👨 **Tebrikler!** ${message.author} ve ${target} resmen evlendi!`);
    }

    if (command === 'profil') {
        const bal = (await db.get(`fam_${userId}`)) || 0;
        const level = (await db.get(`level_${userId}`)) || 1;
        const marriage = await db.get(`marriage_${userId}`);

        let marriageText = "Bekar";
        if (marriage) {
            const days = Math.floor((Date.now() - marriage.date) / (1000 * 60 * 60 * 24));
            marriageText = `<@${marriage.partner}> ile ${days} gündür evli 💍`;
        }

        const embed = new EmbedBuilder()
            .setTitle(`👤 ${message.author.username} Profil`)
            .addFields(
                { name: 'Bakiye', value: `${bal} FAM Coin`, inline: true },
                { name: 'Seviye', value: `Level ${level}`, inline: true },
                { name: 'Evlilik Durumu', value: marriageText, inline: false }
            )
            .setColor('Blurple');

        return message.channel.send({ embeds: [embed] });
    }

    if (command === 'slot') {
        const bet = parseInt(args[0]);
        let bal = (await db.get(`fam_${userId}`)) || 0;
        if (isNaN(bet) || bet <= 0 || bal < bet) return message.reply('Geçerli bir bahis miktarı gir!');

        const slots = ['🎰', '🎲', '💎', '🍒'];
        const s1 = slots[Math.floor(Math.random() * slots.length)];
        const s2 = slots[Math.floor(Math.random() * slots.length)];
        const s3 = slots[Math.floor(Math.random() * slots.length)];

        let win = s1 === s2 && s2 === s3;
        if (win) {
            await db.set(`fam_${userId}`, bal + (bet * 3));
            return message.reply(`[ ${s1} | ${s2} | ${s3} ]\n🔥 **KAZANDIN!** ${bet * 3} FAM Coin hesabına yatırıldı.`);
        } else {
            await db.set(`fam_${userId}`, bal - bet);
            return message.reply(`[ ${s1} | ${s2} | ${s3} ]\n❌ **Kaybettin!** ${bet} FAM Coin gitti.`);
        }
    }

    if (command === 'ask-olcer') {
        const target = message.mentions.users.first();
        if (!target) return message.reply('Biriyle olan aşkını ölçmek için onu etiketle!');
        const percent = Math.floor(Math.random() * 101);
        return message.reply(`❤️ **Aşk Ölçer:** ${message.author} + ${target} = **%${percent}** uyumlu!`);
    }

    if (command === 'zar') {
        const result = Math.floor(Math.random() * 6) + 1;
        return message.reply(`🎲 Zarı attın: **${result}** geldi!`);
    }

    if (command === 'katil') {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply('Önce bir ses kanalına girmelisin!');

        joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator,
            selfDeaf: true
        });

        return message.reply(`📢 **${voiceChannel.name}** kanalına katıldım ve 7/24 buradayım!`);
    }
});

client.login(process.env.DISCORD_TOKEN);
