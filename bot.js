const { Client, GatewayIntentBits, SlashCommandBuilder, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const { Player } = require('discord-player');
const { DeezerAPI } = require('./deezer.js');
const { MusicQueue } = require('./dj-queue.js');
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

const player = new Player(client);
const deezer = new DeezerAPI();
const queues = new Map();
const playerMessages = new Map();

function getQueue(guildId) {
  if (!queues.has(guildId)) {
    queues.set(guildId, new MusicQueue());
  }
  return queues.get(guildId);
}

async function playTrack(guild, voiceChannel, track) {
  try {
    const connection = await player.connections.join(voiceChannel);
    const queue = getQueue(guild.id);
    queue.addTrack(track);

    const resource = await player.play(connection, track.preview || track.link);
    
    updatePlayerEmbed(guild, track);
  } catch (err) {
    console.error('Play error:', err);
  }
}

async function updatePlayerEmbed(guild, track) {
  const queue = getQueue(guild.id);
  const textChannel = guild.channels.cache.find(ch => ch.type === ChannelType.GuildText);
  
  if (!textChannel) return;

  const trackIndex = queue.tracks.indexOf(track) + 1;

  const embed = new EmbedBuilder()
    .setColor('#FF0000')
    .setTitle('DJ-UzyFM')
    .setDescription(`**${track.title}** (${track.album.title}) – ${track.artist.name}`)
    .setThumbnail(track.album.cover_medium)
    .setFooter({ text: `${trackIndex}/${queue.tracks.length}` });

  const backBtn = new ButtonBuilder()
    .setCustomId('btn_back')
    .setLabel('⏪')
    .setStyle(ButtonStyle.Secondary);

  const playBtn = new ButtonBuilder()
    .setCustomId('btn_play')
    .setLabel('⏯️')
    .setStyle(ButtonStyle.Primary);

  const skipBtn = new ButtonBuilder()
    .setCustomId('btn_skip')
    .setLabel('⏩')
    .setStyle(ButtonStyle.Secondary);

  const deezerBtn = new ButtonBuilder()
    .setURL(track.link)
    .setLabel('Open in Deezer')
    .setStyle(ButtonStyle.Link);

  const row = new ActionRowBuilder().addComponents(backBtn, playBtn, skipBtn, deezerBtn);
  
  const msg = await textChannel.send({ embeds: [embed], components: [row] });
  playerMessages.set(guild.id, msg.id);
}

client.once('ready', async () => {
  console.log(`✓ Bot connecté : ${client.user.tag}`);
  
  const commands = [
    new SlashCommandBuilder()
      .setName('search')
      .setDescription('Cherche une musique sur Deezer')
      .addStringOption(opt => opt.setName('musique').setDescription('Nom de la musique').setRequired(true))
      .addStringOption(opt => opt.setName('artiste').setDescription('Nom de l\'artiste').setRequired(false))
      .addStringOption(opt => opt.setName('album').setDescription('Nom de l\'album').setRequired(false)),

    new SlashCommandBuilder()
      .setName('play')
      .setDescription('Joue une musique directement')
      .addStringOption(opt => opt.setName('musique').setDescription('Nom de la musique').setRequired(true))
      .addStringOption(opt => opt.setName('artiste').setDescription('Nom de l\'artiste').setRequired(false))
      .addStringOption(opt => opt.setName('album').setDescription('Nom de l\'album').setRequired(false)),

    new SlashCommandBuilder()
      .setName('join')
      .setDescription('Fait joindre le bot au channel vocal'),

    new SlashCommandBuilder()
      .setName('leave')
      .setDescription('Fait partir le bot du channel vocal'),

    new SlashCommandBuilder()
      .setName('non-stop')
      .setDescription('Crée et joue une playlist aléatoire'),

    new SlashCommandBuilder()
      .setName('restart')
      .setDescription('Redémarre le bot dans le channel vocal'),
  ];

  await client.application.commands.set(commands);
  console.log('✓ Commandes slash enregistrées');
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand() && !interaction.isStringSelectMenu() && !interaction.isButton()) return;

  const { commandName, member, guild, channel } = interaction;

  try {
    if (interaction.isCommand()) {
      await interaction.deferReply();

      switch (commandName) {
        case 'search': {
          const musique = interaction.options.getString('musique');
          const artiste = interaction.options.getString('artiste');
          const album = interaction.options.getString('album');
          
          const results = await deezer.search(musique, artiste, album);
          
          if (results.length === 0) {
            await interaction.editReply('❌ Aucun résultat trouvé.');
            break;
          }

          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_track')
            .setPlaceholder('Choisis une musique...')
            .addOptions(
              results.slice(0, 25).map((track, idx) => ({
                label: `${track.title}`,
                description: `${track.artist.name} • ${track.album.title}`,
                value: JSON.stringify(track),
              }))
            );

          const row = new ActionRowBuilder().addComponents(selectMenu);
          await interaction.editReply({ content: '📋 Résultats de recherche:', components: [row] });
          break;
        }

        case 'play': {
          const musique = interaction.options.getString('musique');
          const artiste = interaction.options.getString('artiste');
          const album = interaction.options.getString('album');

          const voiceChannel = member.voice.channel;
          if (!voiceChannel) {
            await interaction.editReply('❌ Tu dois être dans un channel vocal.');
            break;
          }

          const results = await deezer.search(musique, artiste, album);
          if (results.length === 0) {
            await interaction.editReply('❌ Aucun résultat trouvé.');
            break;
          }

          const track = results[0];
          const queue = getQueue(guild.id);
          queue.addTrack(track);

          await playTrack(guild, voiceChannel, track);
          await interaction.editReply(`▶️ Maintenant en lecture: **${track.title}** - ${track.artist.name}`);
          break;
        }

        case 'join': {
          const voiceChannel = member.voice.channel;
          if (!voiceChannel) {
            await interaction.editReply('❌ Tu dois être dans un channel vocal.');
            break;
          }

          try {
            const connection = await player.connections.join(voiceChannel);
            await interaction.editReply(`✅ Bot rejoint: ${voiceChannel.name}`);
          } catch (e) {
            console.error('Join error:', e);
            await interaction.editReply(`❌ Erreur: ${e.message}`);
          }
          break;
        }

        case 'leave': {
          const voiceChannel = member.voice.channel;
          if (!voiceChannel) {
            await interaction.editReply('❌ Tu dois être dans un channel vocal.');
            break;
          }

          try {
            player.connections.leave(guild.id);
            await interaction.editReply(`✅ Bot parti du channel vocal.`);
          } catch (e) {
            await interaction.editReply(`❌ Erreur: ${e.message}`);
          }
          break;
        }

        case 'non-stop': {
          const voiceChannel = member.voice.channel;
          if (!voiceChannel) {
            await interaction.editReply('❌ Tu dois être dans un channel vocal.');
            break;
          }

          const randomTracks = await deezer.getRandomPlaylist();
          const queue = getQueue(guild.id);
          randomTracks.forEach(t => queue.addTrack(t));

          await playTrack(guild, voiceChannel, randomTracks[0]);
          await interaction.editReply(`🎵 Playlist aléatoire créée avec ${randomTracks.length} musiques!`);
          break;
        }

        case 'restart': {
          const voiceChannel = member.voice.channel;
          if (!voiceChannel) {
            await interaction.editReply('❌ Tu dois être dans un channel vocal.');
            break;
          }

          try {
            player.connections.leave(guild.id);
            await new Promise(r => setTimeout(r, 500));
            await player.connections.join(voiceChannel);
            await interaction.editReply(`🔄 Bot redémarré dans ${voiceChannel.name}`);
          } catch (e) {
            await interaction.editReply(`❌ Erreur: ${e.message}`);
          }
          break;
        }
      }
    } else if (interaction.isStringSelectMenu()) {
      await interaction.deferReply();
      
      if (interaction.customId === 'select_track') {
        const track = JSON.parse(interaction.values[0]);
        const voiceChannel = interaction.member.voice.channel;

        if (!voiceChannel) {
          await interaction.editReply('❌ Tu dois être dans un channel vocal.');
          return;
        }

        const queue = getQueue(interaction.guild.id);
        queue.addTrack(track);

        await playTrack(interaction.guild, voiceChannel, track);
        await interaction.editReply(`▶️ Ajouté à la queue: **${track.title}** - ${track.artist.name}`);
      }
    } else if (interaction.isButton()) {
      await interaction.deferReply();
      
      const queue = getQueue(guild.id);
      
      switch (interaction.customId) {
        case 'btn_skip':
          const nextTrack = queue.skipNext();
          if (nextTrack) {
            await interaction.editReply(`⏩ Track suivant: **${nextTrack.title}**`);
          } else {
            await interaction.editReply('❌ Pas de track suivant.');
          }
          break;
        
        case 'btn_back':
          const prevTrack = queue.skipPrevious();
          if (prevTrack) {
            await interaction.editReply(`⏪ Track précédent: **${prevTrack.title}**`);
          } else {
            await interaction.editReply('❌ Pas de track précédent.');
          }
          break;
        
        case 'btn_play':
          await interaction.editReply('⏯️ Play/Pause (à implémenter)');
          break;
      }
    }
  } catch (err) {
    console.error('Interaction error:', err);
    await interaction.editReply('❌ Erreur lors du traitement.');
  }
});

client.login(process.env.DISCORD_TOKEN);
