require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const http = require('http');

// Render ve UptimeRobot uyumluluğu için mini web sunucusu (7/24 Aktif tutar)
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

client.once('ready', () => {
    console.log(`🤖 ${client.user.tag} olarak başarıyla giriş yapıldı!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const lowerText = message.content.toLowerCase().trim();

    // -------------------------------------------------------------
    // 👋 OTOMATİK SA-AS CEVAP
    // -------------------------------------------------------------
    if (['sa', 'sea', 'selam', 'selamunaleykum', 'selamın aleyküm'].includes(lowerText)) {
        return message.reply(`Aleykümselam **${message.author.username}**, hoş geldin! 👋`);
    }

    const args = message.content.trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // -------------------------------------------------------------
    // 📖 YARDIM MENÜSÜ (!yardım)
    // -------------------------------------------------------------
    if (command === '!yardım' || command === '!help') {
        const helpEmbed = new EmbedBuilder()
            .setTitle('🤖 Bot Komut Listesi')
            .setColor('#7289DA')
            .setDescription('Aşağıda kullanabileceğin tüm komutlar kategorilerine göre listelenmiştir:')
            .addFields(
                { 
                    name: '🛠️ Yönetim & Moderasyon', 
                    value: '`!kur` • Sunucu odalarını otomatik kurar.\n`!duyuru <mesaj>` • Şık duyuru atar.\n`!ban @kullanıcı [sebep]` • Üyeyi banlar.\n`!kick @kullanıcı [sebep]` • Üyeyi atar.\n`!timeout @kullanıcı <dk>` • Zamanaşımı verir.\n`!sil <miktar>` • Mesajları temizler.\n`!yavaş-mod <saniye>` • Kanal yazma hızını ayarlar.' 
                },
                { 
                    name: '📊 Bilgi & Genel', 
                    value: '`!sunucu` • Sunucu istatistiklerini gösterir.\n`!kullanıcı [@kullanıcı]` • Profil bilgilerini gösterir.\n`!avatar [@kullanıcı]` • HD Profil resmini çeker.\n`!ping` • Botun gecikmesini ölçer.' 
                },
                { 
                    name: '🎲 Eğlence & Oyunlar', 
                    value: '`!slot` • Slot makinesini çevirir.\n`!love @kullanıcı` • Aşk uyumunu ölçer.\n`!zar` • Zar atar.\n`!yazı-tura` • Parayı havaya atar.\n`!8ball <soru>` • Gelecek tahmini yapar.' 
                }
            )
            .setFooter({ text: `${message.guild.name} • Yardım Sistemi`, iconURL: message.guild.iconURL() })
            .setTimestamp();

        return message.reply({ embeds: [helpEmbed] });
    }

    // -------------------------------------------------------------
    // 🛠️ SUNUCU KURULUM KOMUTU (!kur)
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

    // -------------------------------------------------------------
    // 📢 EMBED DUYURU KOMUTU (!duyuru <mesaj>)
    // -------------------------------------------------------------
    if (command === '!duyuru') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return message.reply('❌ Duyuru yapmak için **Mesajları Yönet** yetkisine sahip olmalısın!');
        }

        const duyuruMetni = args.join(' ');
        if (!duyuruMetni) {
            return message.reply('❌ Lütfen duyuru metnini yaz! Örn: `!duyuru Akşam turnuva var!`');
        }

        await message.delete().catch(() => {});

        const duyuruEmbed = new EmbedBuilder()
            .setTitle('📢 SUNUCU DUYURUSU')
            .setDescription(duyuruMetni)
            .setColor('#FF0000')
            .setFooter({ text: `Duyuruyu Yapan: ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
            .setTimestamp();

        message.channel.send({ embeds: [duyuruEmbed] });
    }

    // -------------------------------------------------------------
    // ⏳ YAVAŞ MOD KOMUTU (!yavaş-mod <saniye>)
    // -------------------------------------------------------------
    if (command === '!yavaş-mod' || command === '!yavasmod' || command === '!slowmode') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return message.reply('❌ Bu komut için **Kanalları Yönet** yetkisine sahip olmalısın!');
        }

        const seconds = parseInt(args[0]);
        if (isNaN(seconds) || seconds < 0 || seconds > 21600) {
            return message.reply('❌ Lütfen 0 ile 21600 (6 saat) arasında bir saniye değeri gir! (0 = kapatır)\n**Örnek:** `!yavaş-mod 5`');
        }

        try {
            await message.channel.setRateLimitPerUser(seconds);
            if (seconds === 0) {
                message.reply('✅ Bu kanaldaki yavaş mod **kaldırıldı**.');
            } else {
                message.reply(`⏳ Kanalın yavaş modu **${seconds} saniye** olarak ayarlandı.`);
            }
        } catch (error) {
            console.error(error);
            message.reply('❌ Yavaş mod ayarlanırken bir hata oluştu.');
        }
    }

    // -------------------------------------------------------------
    // 👤 KULLANICI BİLGİ KOMUTU (!kullanıcı [@kullanıcı])
    // -------------------------------------------------------------
    if (command === '!kullanıcı' || command === '!user') {
        const targetMember = message.mentions.members.first() || message.member;
        const user = targetMember.user;

        const userEmbed = new EmbedBuilder()
            .setTitle(`👤 ${user.username} Profil Bilgileri`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 512 }))
            .setColor('#3498DB')
            .addFields(
                { name: '🆔 Kullanıcı ID', value: user.id, inline: true },
                { name: '🏷️ Etiket / Kullanıcı Adı', value: user.tag, inline: true },
                { name: '📅 Discord\'a Katılım Tarihi', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`, inline: false },
                { name: '🏰 Sunucuya Katılım Tarihi', value: `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:F>`, inline: false }
            )
            .setFooter({ text: `İsteyen: ${message.author.username}` });

        message.reply({ embeds: [userEmbed] });
    }

    // -------------------------------------------------------------
    // 🖼️ AVATAR KOMUTU (!avatar [@kullanıcı])
    // -------------------------------------------------------------
    if (command === '!avatar') {
        const targetUser = message.mentions.users.first() || message.author;
        const avatarUrl = targetUser.displayAvatarURL({ dynamic: true, size: 1024 });

        const avatarEmbed = new EmbedBuilder()
            .setTitle(`🖼️ ${targetUser.username} Profil Fotoğrafı`)
            .setImage(avatarUrl)
            .setColor('#5865F2')
            .setFooter({ text: `İsteyen: ${message.author.username}` });

        message.reply({ embeds: [avatarEmbed] });
    }

    // -------------------------------------------------------------
    // 📊 SUNUCU BİLGİ KOMUTU (!sunucu)
    // -------------------------------------------------------------
    if (command === '!sunucu') {
        const guild = message.guild;

        const serverEmbed = new EmbedBuilder()
            .setTitle(`🏰 ${guild.name} Sunucu Bilgileri`)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .setColor('#57F287')
            .addFields(
                { name: '👥 Üye Sayısı', value: `${guild.memberCount}`, inline: true },
                { name: '👑 Sunucu Sahibi', value: `<@${guild.ownerId}>`, inline: true },
                { name: '📅 Kuruluş Tarihi', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true }
            )
            .setFooter({ text: `Sunucu ID: ${guild.id}` });

        message.reply({ embeds: [serverEmbed] });
    }

    // -------------------------------------------------------------
    // 🏓 PING KOMUTU (!ping)
    // -------------------------------------------------------------
    if (command === '!ping') {
        message.reply(`🏓 Pong! Bot Gecikmesi: **${client.ws.ping}ms**`);
    }

    // -------------------------------------------------------------
    // 🎰 SLOT MAKİNESİ (!slot)
    // -------------------------------------------------------------
    if (command === '!slot') {
        const slotItems = ['🍎', '🍋', '🍒', '7️⃣', '💎'];
        const item1 = slotItems[Math.floor(Math.random() * slotItems.length)];
        const item2 = slotItems[Math.floor(Math.random() * slotItems.length)];
        const item3 = slotItems[Math.floor(Math.random() * slotItems.length)];

        let resultText = '❌ Kaybettin kanka, tekrar dene!';
        if (item1 === item2 && item2 === item3) {
            resultText = '🎉 **JACKPOT! BÜYÜK İKRAMİYEYİ KAZANDIN!** 💎';
        } else if (item1 === item2 || item2 === item3 || item1 === item3) {
            resultText = '✨ Fena değil, 2 eşleşme yakaladın!';
        }

        const slotEmbed = new EmbedBuilder()
            .setTitle('🎰 Slot Makinesi')
            .setDescription(`**[ ${item1} | ${item2} | ${item3} ]**\n\n${resultText}`)
            .setColor('#F1C40F')
            .setFooter({ text: `Oynayan: ${message.author.username}` });

        message.reply({ embeds: [slotEmbed] });
    }

    // -------------------------------------------------------------
    // ❤️ AŞK ÖLÇER / SHIP KOMUTU (!love @kullanıcı)
    // -------------------------------------------------------------
    if (command === '!love' || command === '!ship') {
        const target = message.mentions.users.first();
        if (!target) return message.reply('❌ Lütfen aşkını ölçmek istediğin birini etiketle!');
        if (target.id === message.author.id) return message.reply('❌ Kendinle aşk yaşayamazsın kanka!');

        const lovePercent = Math.floor(Math.random() * 101);
        let loveBar = '💖'.repeat(Math.floor(lovePercent / 10)) + '🖤'.repeat(10 - Math.floor(lovePercent / 10));

        const loveEmbed = new EmbedBuilder()
            .setTitle('❤️ Aşk & Uyum Ölçer')
            .setDescription(`**${message.author.username}** ile **${target.username}** arasındaki uyum:\n\n**%${lovePercent}**\n[ ${loveBar} ]`)
            .setColor('#E91E63');

        message.reply({ embeds: [loveEmbed] });
    }

    // -------------------------------------------------------------
    // 🎲 DİĞER EĞLENCE KOMUTLARI (!zar, !yazı-tura, !8ball)
    // -------------------------------------------------------------
    if (command === '!zar') {
        const zar = Math.floor(Math.random() * 6) + 1;
        message.reply(`🎲 Zarı attın ve **${zar}** geldi!`);
    }

    if (command === '!yazı-tura' || command === '!yazitura') {
        const sonuc = Math.random() < 0.5 ? 'YAZI 🪙' : 'TURA 🪙';
        message.reply(`Parayı havaya attın... Sonuç: **${sonuc}**`);
    }

    if (command === '!8ball') {
        const soru = args.join(' ');
        if (!soru) return message.reply('❌ Lütfen bana bir soru sor! Örn: `!8ball Bu sunucu tutar mı?`');

        const cevaplar = [
            'Kesinlikle evet! 🔥',
            'Buna hiç şüphen olmasın. 😎',
            'Büyük ihtimalle evet.',
            'Şu an kestiremiyorum, sonra tekrar sor. 🤔',
            'Pek sanmıyorum kanka...',
            'İmkansız gibi bir şey! ❌'
        ];

        const rastgeleCevap = cevaplar[Math.floor(Math.random() * cevaplar.length)];
        message.reply(`🔮 **Soru:** ${soru}\n💬 **Cevap:** ${rastgeleCevap}`);
    }

    // -------------------------------------------------------------
    // 🔨 BAN / KICK / TIMEOUT / SIL KOMUTLARI
    // -------------------------------------------------------------
    if (command === '!ban') {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return message.reply('❌ Bu komutu kullanmak için **Üyeleri Yasakla** yetkisine sahip olmalısın!');
        }
        const targetMember = message.mentions.members.first();
        const reason = args.slice(1).join(' ') || 'Sebep belirtilmedi.';
        if (!targetMember) return message.reply('❌ Lütfen banlanacak kişiyi etiketle!');
        if (!targetMember.bannable) return message.reply('❌ Bu kullanıcıyı banlayamıyorum.');

        try {
            await targetMember.ban({ reason });
            message.reply(`🚨 **${targetMember.user.tag}** sunucudan yasaklandı! **Sebep:** ${reason}`);
        } catch (error) {
            console.error(error);
            message.reply('❌ Banlama işlemi sırasında bir hata oluştu.');
        }
    }

    if (command === '!kick') {
        if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
            return message.reply('❌ Bu komutu kullanmak için **Üyeleri At** yetkisine sahip olmalısın!');
        }
        const targetMember = message.mentions.members.first();
        const reason = args.slice(1).join(' ') || 'Sebep belirtilmedi.';
        if (!targetMember) return message.reply('❌ Lütfen atılacak kişiyi etiketle!');
        if (!targetMember.kickable) return message.reply('❌ Bu kullanıcıyı sunucudan atamıyorum.');

        try {
            await targetMember.kick(reason);
            message.reply(`👞 **${targetMember.user.tag}** sunucudan atıldı! **Sebep:** ${reason}`);
        } catch (error) {
            console.error(error);
            message.reply('❌ Atma işlemi sırasında bir hata oluştu.');
        }
    }

    if (command === '!timeout' || command === '!sustur') {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return message.reply('❌ Bu komutu kullanmak için **Üyeleri Zamana Aşımına Uğrat** yetkisine sahip olmalısın!');
        }
        const targetMember = message.mentions.members.first();
        const minutes = parseInt(args[1]);
        const reason = args.slice(2).join(' ') || 'Sebep belirtilmedi.';
        if (!targetMember || isNaN(minutes)) return message.reply('❌ Doğru kullanım: `!timeout @kullanıcı <dakika> [sebep]`');
        if (!targetMember.moderatable) return message.reply('❌ Bu kullanıcıya zaman aşımı uygulayamıyorum.');

        try {
            await targetMember.timeout(minutes * 60 * 1000, reason);
            message.reply(`⏱️ **${targetMember.user.tag}** **${minutes} dakika** susturuldu! **Sebep:** ${reason}`);
        } catch (error) {
            console.error(error);
            message.reply('❌ Zaman aşımı uygulanırken bir hata oluştu.');
        }
    }

    if (command === '!sil' || command === '!clear') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return message.reply('❌ Bu komutu kullanmak için **Mesajları Yönet** yetkisine sahip olmalısın!');
        }
        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount < 1 || amount > 100) return message.reply('❌ Lütfen 1 ile 100 arasında bir sayı gir!');

        try {
            await message.channel.bulkDelete(amount, true);
            const noticeMsg = await message.channel.send(`🧹 **${amount}** adet mesaj temizlendi!`);
            setTimeout(() => noticeMsg.delete().catch(() => {}), 3000);
        } catch (error) {
            console.error(error);
            message.reply('❌ Mesajlar silinirken hata oluştu.');
        }
    }
});

client.login(process.env.TOKEN);
