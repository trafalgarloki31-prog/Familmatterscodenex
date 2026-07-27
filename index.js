require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } = require('discord.js');
const http = require('http');

// Render ve UptimeRobot için 7/24 uyanık tutma sunucusu (Her isteğe 200 OK döner)
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.write("Bot 7/24 Aktif!");
    res.end();
}).listen(process.env.PORT || 3000, () => {
    console.log("Web sunucusu Render için portu dinlemeye başladı.");
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () => {
    console.log(`🤖 ${client.user.tag} olarak bağlandı, kuruluma hazır!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '!kur') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Bu komutu sadece **Yöneticiler** kullanabilir!');
        }

        const guild = message.guild;
        const statusMsg = await message.reply('⏳ Odalar kuruluyor kanka, biraz bekle...');

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

            await statusMsg.edit('✅ **Tüm odalar fotoğraftaki gibi eksiksiz kuruldu!**');
        } catch (error) {
            console.error(error);
            await statusMsg.edit('❌ Odalar kurulurken bir hata oluştu. Botun yetkilerini kontrol et.');
        }
    }
});

client.login(process.env.TOKEN);
