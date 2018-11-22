var discord = require("discord.js");        
var ytdl = require('ytdl-core');         
// youtube API requests   
var youtube = require('./youtube.js');      

var bot = new discord.Client();
var ytAudioQueue = [];
var dispatcher = null;
var YoutubeStream = require('youtube-audio-stream');
// id du serveur
const id = '';
// token bot
const token = '';
var defaultChannel = '';
var loop = false;

// Bot opérationnel
bot.on('ready', function() {
    console.log("Bot opérationnel !")
});

// Message d'entrée dans le salon (MP)
bot.on('guildMemberAdd', member => {
    member.createDM().then(channel => {
        return channel.send('Bienvenue sur mon serveur ' + member.displayName);
    }).catch(console.error)
    // On pourrait catch l'erreur autrement ici (l'utilisateur a peut être désactivé les MP)
});

// Message de sortie dans le salon
bot.on('guildMemberRemove', member => {
    const welcomechannel = member.guild.channels.find('id', token);
    var embed = new discord.RichEmbed()
        .setColor('#76D880')
        .setDescription(`:inbox_tray: <@${member.user.id}>nous a quitté ! On est mieux sans lui. `);
    return welcomechannel.send({embed});
});

// Analyse des commandes
bot.on('message', function (message) {
    // Le bot ne traduit pas ses propres messages
    if (message.author===bot.user){
        return;
    }
    defaultChannel = message.channel;
    var messageParts = message.content.split(' ');
    var command = messageParts[0].toLowerCase();
    var parameters = messageParts.splice(1, messageParts.length);
    switch (command) {
        case "!help":
            HelpCommand(message);
            break;
        case "!skip":
            SkipCommand();
            break;
        case "!stop":
            StopCommand(message.guild);
            break;
        case "!play":
            PlayCommand(message, parameters.join(" "));
            break;
        case "!loop":
            LoopCommand();
            break;
        case "!endloop":
            EndLoopCommand();
            break;
        case "!roll":
            if (parameters.length>0){
                RollCommand(parameters[0]);
            } else {
                RollCommand('6');
            }
            break;
        case "!pause":
            PauseCommand();
            break;
        case "!queue":
            PlayQueueCommand(message);
            break;
        case "!someone":
            SomeoneCommand(message.channel);
            break;
    }
});

// liste toutes les commandes du bot
function HelpCommand(message) {
    var help = "";
    help += "__Musique :__\n";
    help += "**!play <Mots clés Youtube>** - Joue la musique Youtube en fonction des mots clés \n";
    help += "**!queue** - Liste les musiques présentes dans la file \n";
    help += "**!skip** - Passe à la musique suivante \n";
    help += "**!play / !pause** - Resp. Enlève/Met la musique en pause\n";
    help += "**!loop / !endloop** - Resp. Met/Enlève la musique en cours en boucle\n";
    help += "**!stop** - Arrête la musique\n";
    help += "\n__Divers :__\n";
    help += "**!someone** - Affiche une personne au hasard \n";
    help += "**!roll <Nombre>** - Lance un dé à nb faces";
    message.author.send(help);
}

// joue un audio en fonction d'une recherche youtube
function PlayCommand(message, searchTerm) {
    if (searchTerm==''){
        if (dispatcher!=null){
            // si une musique est en pause, on la relance
            if (dispatcher.paused){
                dispatcher.resume();
                defaultChannel.send("Musique en lecture");
                return;
            }
        }
        defaultChannel.send("Il faut ajouter des mots clés !");
        return;
    }
    // le bot se connecte au salon où se trouve l'utilisateur qui demande
    if (bot.voiceConnections.array().length == 0) {
        if (message.member.voiceChannel) {
            message.member.voiceChannel.join();
        } else {
            message.reply('Il faut d\'abord rejoindre un salon vocal !');
            return;
        }
    }
    // cherche une video youtube en fonction des mots clés et éxectue la methode si trouvée
    youtube.search(searchTerm, QueueYtAudioStream);
}

// liste les musiques dans la file
function PlayQueueCommand(message) {
    var queueString = "";
    if (ytAudioQueue.length>0){
        queueString += "__Morceau en cours :__ \n";
        queueString += ytAudioQueue[0].videoName;
        if (loop==true) queueString += " **(boucle)**";
        queueString += "\n\n__A suivre :__ \n";
        for(var x = 1; x < ytAudioQueue.length; x++) {
            queueString += x + '. ' + ytAudioQueue[x].videoName + "\n";
        }
    } else {
        queueString += "File vide !";
    }
    defaultChannel.send(queueString);
}

// diffusion audio en pause
function PauseCommand() {
    if (dispatcher!=null){
        dispatcher.pause();
    }
    defaultChannel.send("Musique en pause");
}

// musique en cours en boucle
function LoopCommand() {
    defaultChannel.send('Boucle activée.');
    loop = true;
    if (ytAudioQueue.length != 0) {
        var url = ytAudioQueue[0].streamUrl;
        dispatcher.on('end', () => {
            dispatcher = null;
            PlayStream(url);
        });
    }
}

// fin musique en cours en boucle
function EndLoopCommand() {
    defaultChannel.send('Boucle désactivée.');
    loop = false;
    dispatcher.on('end', () => {
        dispatcher = null;
        PlayNextStreamInQueue();
    });
}

// passe à la musique suivante
function SkipCommand(channel) {
    if (dispatcher!=null){
        if (loop==true){
            EndLoopCommand();
        }
        dispatcher.end();
    }
    defaultChannel.send("Skipped");
}

// arrete la diffusion de musique
function StopCommand(guild) {
    var voiceChannel;
    var membersArray = guild.members.array();
    for(var guildMemberId in membersArray) {
        if (membersArray[guildMemberId].user===bot.user) {
            voiceChannel = membersArray[guildMemberId].voiceChannel;
            break;
        }
    }
    if (voiceChannel) {
        ytAudioQueue = [];
        voiceChannel.leave();
    }
}

// affiche un utilisateur au hasard
function SomeoneCommand(channel) {
    if (channel instanceof discord.TextChannel){
        var users = [];
        var membersArray = channel.guild.members.array();

        for(var guildMemberId in membersArray) {
            if (membersArray[guildMemberId].user.id!=bot.user.id) {
                users.push(membersArray[guildMemberId].user);
            }
        }
        
        var random = Math.floor(Math.random() * Math.floor(users.length));
        defaultChannel.send(`<@${users[random].id}>`);
    } else {
        defaultChannel.send("Vous devez être dans un salon textuel.");
    }
}

// lance un dé
function RollCommand(maxString) {
    try {
        var max = parseInt(maxString);
        var random = Math.floor(Math.random() * Math.floor(max)) + 1;
        defaultChannel.send(random);
    } catch (error) {
        defaultChannel.send(error);
    }
}

// Affiche le morceau en cours
function DisplayCurrentAudio() {
    var message = ':notes: ***Musique en cours*** :notes:' + '\n';
    message += ytAudioQueue[0].videoName;
    defaultChannel.send(message, {
        files: [
            ytAudioQueue[0].videoImageUrl
        ]
    });
}

// Affiche l'ajout à la file
function DisplayAddQueue(videoName) {
    defaultChannel.send("**Ajouté à la file : **" + videoName);
}

// Queues result of Youtube search into stream
function QueueYtAudioStream(videoId, videoName, videoImageUrl) {
    var streamUrl = `${youtube.watchVideoUrl}${videoId}`;
    if (!ytAudioQueue.length) {
        ytAudioQueue.push(
            {
                'streamUrl': streamUrl,
                'videoName': videoName,
                'videoImageUrl' : videoImageUrl
            }
        );
        PlayStream(ytAudioQueue[0].streamUrl);
    }
    else {
        ytAudioQueue.push(
            {
                'streamUrl': streamUrl,
                'videoName': videoName,
                'videoImageUrl' : videoImageUrl
            }
        );
        DisplayAddQueue(videoName);
    }
}

// Plays a given stream
function PlayStream(streamUrl) {
    const streamOptions = {seek: 0, volume: 0.5};
    if (streamUrl) {
        const stream = ytdl(streamUrl, {filter: 'audioonly'});
        if (dispatcher == null) {
            var voiceConnection = bot.voiceConnections.first();
            if (voiceConnection) {
                DisplayCurrentAudio();
                dispatcher = bot.voiceConnections.first().playStream(stream, streamOptions);
                dispatcher.on('end', () => {
                    dispatcher = null;                 
                    PlayNextStreamInQueue();
                });
                dispatcher.on('error', (err) => {
                    console.log(err);
                });
            }
        }
        else {
            dispatcher = bot.voiceConnections.first().playStream(stream, streamOptions);
        }
    }
}

// Plays the next stream in the queue
function PlayNextStreamInQueue() {
    ytAudioQueue.splice(0, 1);
    // if there are streams remaining in the queue then try to play
    if (ytAudioQueue.length != 0) {
        PlayStream(ytAudioQueue[0].streamUrl);
    }
}

bot.login(id);
