const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { DisTube } = require('distube');
const { SpotifyPlugin } = require('@distube/spotify');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const distube = new DisTube(client, {
  leaveOnFinish: false,
  emitNewSongOnly: true,
  plugins: [
    new SpotifyPlugin(),
  ],
});

const queues = new Map();

client.once('ready', async () => {
  console.log(`✓ Bot connecté : ${client.user.tag}`);
  
  const commands = [
    new SlashCommandBuilder()
      .setName('search')
      .setDescription('Cherche une musique')
      .addStringOption(opt => opt.setName('query').setDescription('Titre ou artiste').setRequired(true)),

    new SlashCommandBuilder()
      .setName('play')
      .setDescription('Joue une musique')
      .addStringOption(opt => opt.setName('query').setDescription('Titre ou artiste').setRequired(true)),

    new SlashCommandBuilder()
      .setName('stop')
      .setDescription('Arrête la musique'),

    new SlashCommandBuilder()
      .setName('skip')
      .setDescription('Passe à la musique suivante'),

    new SlashCommandBuilder()
      .setName('pause')
      .setDescription('Met en pause'),

    new SlashCommandBuilder()
      .setName('resume')
      .setDescription('Reprend la musique'),

    new SlashCommandBuilder()
      .setName('queue')
      .setDescription('Affiche la queue'),

    new SlashCommandBuilder()
      .setName('join')
      .setDescription('Fait joindre le bot au channel vocal'),

    new SlashCommandBuilder()
      .setName('leave')
      .setDescription('Fait partir le bot'),
  ];

  await client.application.commands.set(commands);
  console.log('✓ Commandes slash enregistrées');
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, member, guild } = interaction;

  try {
    await interaction.deferReply();

    switch (commandName) {
      case 'play': {
        const query = interaction.options.getString('query');
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
          await interaction.editReply('❌ Tu dois être dans un channel vocal.');
          break;
        }

        try {
          await distube.play(voiceChannel, query, {
            member: interaction.member,
            textChannel: interaction.channel,
            interaction: interaction,
          });
          await interaction.editReply(`▶️ En cours de lecture...`);
        } catch (e) {
          await interaction.editReply(`❌ Erreur: ${e.message}`);
        }
        break;
      }

      case 'search': {
        const query = interaction.options.getString('query');
        const results = await distube.search(query, { limit: 5 });

        if (results.length === 0) {
          await interaction.editReply('❌ Aucun résultat trouvé.');
          break;
        }

        const embed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('🔍 Résultats de recherche')
          .setDescription(results.map((s, i) => `${i + 1}. **${s.name}** - ${s.source}`).join('\n'));

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case 'skip': {
        const queue = distube.getQueue(guild.id);
        if (!queue) {
          await interaction.editReply('❌ Aucune musique en lecture.');
          break;
        }

        queue.skip();
        await interaction.editReply('⏩ Musique suivante...');
        break;
      }

      case 'stop': {
        const queue = distube.getQueue(guild.id);
        if (!queue) {
          await interaction.editReply('❌ Aucune musique en lecture.');
          break;
        }

        queue.stop();
        await interaction.editReply('⏹️ Musique arrêtée.');
        break;
      }

      case 'pause': {
        const queue = distube.getQueue(guild.id);
        if (!queue) {
          await interaction.editReply('❌ Aucune musique en lecture.');
          break;
        }

        if (queue.paused) {
          await interaction.editReply('⏸️ Déjà en pause.');
          break;
        }

        queue.pause();
        await interaction.editReply('⏸️ Musique en pause.');
        break;
      }

      case 'resume': {
        const queue = distube.getQueue(guild.id);
        if (!queue) {
          await interaction.editReply('❌ Aucune musique en lecture.');
          break;
        }

        if (!queue.paused) {
          await interaction.editReply('▶️ Déjà en lecture.');
          break;
        }

        queue.resume();
        await interaction.editReply('▶️ Musique reprise.');
        break;
      }

      case 'queue': {
        const queue = distube.getQueue(guild.id);
        if (!queue || queue.songs.length === 0) {
          await interaction.editReply('❌ Queue vide.');
          break;
        }

        const embed = new EmbedBuilder()
          .setColor('#FF0000')
          .setTitle('📋 Queue')
          .setDescription(queue.songs.slice(0, 10).map((s, i) => `${i + 1}. **${s.name}** (${s.source})`).join('\n'))
          .setFooter({ text: `Total: ${queue.songs.length} musiques` });

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case 'join': {
        const voiceChannel = member.voice.channel;
        if (!voiceChannel) {
          await interaction.editReply('❌ Tu dois être dans un channel vocal.');
          break;
        }

        await voiceChannel.join();
        await interaction.editReply(`✅ Bot rejoint: ${voiceChannel.name}`);
        break;
      }

      case 'leave': {
        const queue = distube.getQueue(guild.id);
        if (queue) {
          queue.stop();
        }
        await interaction.editReply('✅ Bot parti.');
        break;
      }
    }
  } catch (err) {
    console.error('Interaction error:', err);
    await interaction.editReply('❌ Erreur lors du traitement.');
  }
});

distube.on('playSong', (queue, song) => {
  queue.textChannel?.send(
    `🎵 **${song.name}** - ${song.uploader.name}\n⏱️ ${song.formattedDuration}`
  );
});

distube.on('addSong', (queue, song) => {
  queue.textChannel?.send(`➕ **${song.name}** ajoutée à la queue`);
});

distube.on('error', (channel, e) => {
  if (channel) {
    channel.send(`❌ Erreur: ${e.message}`);
  }
  console.error('DisTube error:', e);
});

client.login(process.env.DISCORD_TOKEN);
