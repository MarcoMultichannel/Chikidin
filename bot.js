//TODO classi di complessità, contrario, Random, GeneraTeams, DanniAnnie
//const Discord = require('discord.io'); ADDIO discord.io
const Discord = require("discord.js");
const auth = require('./auth.json');

const logger = require('winston');
const fs = require('fs');

//Iniziallizza LOG
logger.remove(logger.transports.Console);
logger.add
(
	new logger.transports.Console,
	{colorize: true}
);
logger.level = 'debug';

//Crea oggetto bot
const bot = new Discord.Client();
bot.login(auth.token);
/*var bot = new Discord.Client
({
   token: auth.token,
   autorun: true
});*/

//Files
var fileImpostazioni='impostazioni.json';
var fileCoppie='coppie.json';
var fileRicordi='ricordi.json';
var fileComplessita='complessita.json';

var ricordi={};
var coppie={};
var impostazioni={};
var complessita={};

const START_CHAR='!';
const DEFAULT_PROBABILITY=3;
const PROBABILITY_KICK_ROULETTE=7;
const MIN_YEAR=2019;
const SERVER_ID=688449703263731712;

var kickRouletteOccurring=false;
//Quando il bot è pronto
bot.once('ready', 
	function (evt) 
	{
		logger.info(bot.user.username + ' - (' + bot.user.id + ') Connesso.');
		caricaRicordi();
		caricaCoppie();
		caricaImpostazioni();
		caricaComplessita();
		//Controlla ricordi ogni minuto
		setInterval(controllaRicordi, 60*1000);
	}
);
//Quando il bot legge un messaggio
bot.on('message', 
	function (message, evt) 
	{
		var user=message.user;
		var userID=message.author.id;
		var channel=message.channel;
		var channelID=message.channel.id;
		var message=message.content;
		//logger.info(userID+' '+bot.user.id);
		if(userID!=bot.user.id)
		{//IL MESSAGGIO NON E' STATO INVIATO DAL BOT
			rispondiAlleParoleChiavi(channel,message);
			
			if (message.substring(0,1)==START_CHAR) 
			{//SE COMINCIA PER IL CARATTERE START
				var parametri=message.substring(1).split(' ');
				var comando=parametri[0];
				parametri=parametri.splice(1);
				switch(comando) 
				{
					case 'help':
						if(numeroParametri(parametri,0))
							rispostaHelp(channel);
						else rispondiErrore(channel);
					break;
					case 'complessità':
						if(numeroParametriMaggioreUgualeDi(parametri,1))
						{
							var messaggio='';
							var relazioniValide={};
							relazioniValide.num=0;
							for(var i=0;i<complessita.numeroComplessita;i++)
							{
								var inserire=false;
								for(var j=0;j<parametri.length;j++)
									if(complessita[i].includes(parametri[j]))
										inserire=true;
								if(inserire)
								{
									relazioniValide[relazioniValide.num]=complessita[i];
									relazioniValide.num++;
								}
							}
							messaggio=generaRelazioneComplessita(relazioniValide);
							if(!stringheUguali(messaggio,''))
								inviaMessaggio(channel,messaggio);
							else
								inviaMessaggio(channel,'Niente.');
						}
						else rispondiErrore(channel);
					break;
					case 'aggiungiComplessità':
						if(numeroParametriMaggioreUgualeDi(parametri,1))
						{
							var stringa=generaStringaDaParametri(parametri,0);
							aggiungiComplessita(stringa);
							salvaComplessitaSuFile();
							inviaMessaggio(channel,'Aggiunto '+stringa);
						}
						else rispondiErrore(channel);
					break;
					case 'kickRoulette':
						if(numeroParametri(parametri,0) && !kickRouletteOccurring)
						{
							var canaleVoce=getVoiceChannelFromUserID(userID);
							if(canaleVoce!=null)
							{
								var kicking=randomBoolean(PROBABILITY_KICK_ROULETTE);
								if(kicking)
								{
									inviaMessaggio(channel,'Sayonara.');
									kickRouletteOccurring=true;
									kickAction=setInterval(
										function()
										{ 
											return kickDallChiamata(userID,canaleVoce);
										}, 500
									);
									setTimeout(
										function()
										{
											clearInterval(kickAction);
											kickRouletteOccurring=false;
											inviaMessaggio(channel,'Hai sofferto abbastanza <@!'+userID+'>');
										}, 5*60*1000
									);
								}
								else
								{
									inviaMessaggio(channel,'Sei stato graziato.');
								}
							}
							else rispondiErrore(channel);
						}
						else rispondiErrore(channel);
					break;
					case 'impostaCanaleRicordi':
						if(numeroParametri(parametri,0))
						{
							impostaCanaleRicordi(channel);
							salvaImpostazioniSuFile();
							inviaMessaggio(channel,'Il canale dei ricordi è stato impostato a <#'+channelID+'>');
						}
						else rispondiErrore(channel);
					break;
					case 'aggiungiTag':
						if(numeroParametri(parametri,2) && isDiscordTag(parametri[0]))
						{
							var id=parametri[0];
							var nome=parametri[1];
							//vedi se già c'è
							if(!coppiaPresente(nome))
							{
								aggiungiCoppia(nome,id,0);
								salvaCoppieSuFile();
								inviaMessaggio(channel,'Ogni volta che nominerai '+nome+' verr\à taggato '+id);
							}
							else rispondiErrore(channel);
						}
						else rispondiErrore(channel);
					break;
					case 'rimuoviTag':
						if(numeroParametri(parametri,1))
						{
							var nome=parametri[0];
							if(coppiaPresente(nome))
							{
								rimuoviCoppia(nome);
								salvaCoppieSuFile();
								inviaMessaggio(channel,'Rimosso il tag di '+nome);
							}
							else rispondiErrore(channel); 
						}
						else rispondiErrore(channel);
					break;
					case 'mostraTag':
						if(numeroParametri(parametri,0))
						{
							var messaggio=stringaCoppieTag();
							inviaMessaggio(channel,messaggio);
						}
						else rispondiErrore(channel);
					break;
					case 'ricorda':
						if(numeroParametriMaggioreUgualeDi(parametri,5))
						{
							var errore=false;
							var oraMinuti=parametri[0];
							var giorno=parametri[1];
							var mese=parametri[2];
							var anno=parametri[3];
							var soloOra=oraMinuti;
							var soloMinuti=0;
							if(!isNumber(giorno) || !isNumber(mese) || !isNumber(anno)) errore=true;
							if(contiene(oraMinuti,':'))
							{
								oraMinuti=oraMinuti.split(':');
								if(!numeroParametri(oraMinuti,2)) errore=true;
								else
								{
									soloOra=oraMinuti[0];
									soloMinuti=oraMinuti[1];
								}
							}
							if(errore==false && !dataValida(soloOra,soloMinuti,giorno,mese,anno)) errore=true;
							else if(errore==false)
							{//Data valida
								var data=new Date(anno, parseInt(mese-1), giorno, soloOra, soloMinuti, 0, 0);
								if(dataVecchia(data)) 
									errore=true;
								else
								{
									var stringa=generaStringaDaParametri(parametri,4);
									aggiungiRicordo(data,userID,stringa);
									salvaRicordiSuFile();
									var minutiVisualizzati=data.getMinutes();
									if(minutiVisualizzati<10)
										minutiVisualizzati='0'+data.getMinutes()
									inviaMessaggio(channel,'Alle ore '+data.getHours()+':'+
										minutiVisualizzati+' del '+data.getDate()+'/'+(data.getMonth()+1)+'/'+
										data.getFullYear()+' ricorderò a <@!'+userID+'> che '+stringa);
								}
								
							}
						}
						else errore=true;
						if(errore) rispondiErrore(channel);
					break;
					case 'ricordaA':
						if(numeroParametriMaggioreUgualeDi(parametri,6) && isDiscordTag(parametri[0]))
						{
							var errore=false;
							var userID=tagToClientID(parametri[0]);
							var oraMinuti=parametri[1];
							var giorno=parametri[2];
							var mese=parametri[3];
							var anno=parametri[4];
							var soloOra=oraMinuti;
							var soloMinuti=0;
							if(!isNumber(giorno) || !isNumber(mese) || !isNumber(anno)) errore=true;
							if(contiene(oraMinuti,':'))
							{
								oraMinuti=oraMinuti.split(':');
								if(!numeroParametri(oraMinuti,2)) errore=true;
								else
								{
									soloOra=oraMinuti[0];
									soloMinuti=oraMinuti[1];
								}
							}
							if(errore==false && !dataValida(soloOra,soloMinuti,giorno,mese,anno)) errore=true;
							else if(errore==false)
							{//Data valida
								var data=new Date(anno, parseInt(mese-1), giorno, soloOra, soloMinuti, 0, 0);
								if(dataVecchia(data)) 
									errore=true;
								else
								{
									var stringa=generaStringaDaParametri(parametri,5);
									aggiungiRicordo(data,userID,stringa);
									salvaRicordiSuFile();
									var minutiVisualizzati=data.getMinutes();
									if(minutiVisualizzati<10)
										minutiVisualizzati='0'+data.getMinutes()
									inviaMessaggio(channel,'Alle ore '+data.getHours()+':'+
										minutiVisualizzati+' del '+data.getDate()+'/'+(data.getMonth()+1)+'/'+
										data.getFullYear()+' ricorderò a <@!'+userID+'> che '+stringa
									);
								}
								
							}
						}
						else errore=true;
						if(errore) rispondiErrore(channel);
					break;
					case 'mostraRicordi':
						if(numeroParametri(parametri,0))
						{
							var messaggio=stringaRicordi(userID);
							inviaMessaggio(channel,messaggio);
						}
						else rispondiErrore(channel);
					break;
					case 'rimuoviRicordo':
						if(numeroParametri(parametri,1) && isNumber(parametri[0]) && parametri[0]>0 && parametri[0]<=ricordi.numeroRicordi)
						{
							var indice=parametri[0];
							if(ricordi[indice-1].userID==userID)
							{
								rimuoviRicordo(ricordi[indice-1]);
								salvaRicordiSuFile();
								inviaMessaggio(channel,'Ricordo eliminato');
							}
							else rispondiErrore(channel);
						}
						else rispondiErrore(channel);
					break;
				}
			}
		}
	}
);


//DEFINIZIONE DELLE FUNZIONI
function classeGiaInArray(arrayClassi,classe)
{
	for(var i=0;i<arrayClassi.num;i++)
	{
		if(stringheUguali(arrayClassi[i],classe))
			return true;
	}
	return false;
}
function prendiClassiDaRelazione(classi,relazione)
{/*
	var specialCharacters=['⊆', '⊂', '=', ' ', '=>', '≠'];
	var resultString=relazione;
	for(var i=0;i<specialCharacters.length;i++)
	{
		for(var j=0;j<resultString.length;j++)
		{
			if(resultString.includes(specialCharacters[i])
				resultString=resultString[j].split(specialCharacters[i]);
		}
		
	}
	for(var i=0;i<resultString.length;i++)
	{
		if(classeGiaInArray(classi,resultString[i])
		{
			classi[classi.num]=filtrataDaInclusoStretto[i];
			classi.num++;
		}
	}*/
}
function generaRelazioneComplessita(relazioni)
{
	var risultato="";/*
	var classi={};
	classi.num=0;
	for(var i=0;i<relazioni.num;i++)
	{
		prendiClassiDaRelazione(classi,relazioni[i]);
	}*/
	return risultato;
}
function aggiungiComplessita(stringa)
{
	complessita[complessita.numeroComplessita]=stringa;
	complessita.numeroComplessita++;
}
function salvaComplessitaSuFile()
{
	salvaOggettoSuFile(complessita,fileComplessita);
}
function kickDallChiamata(userID,canaleVoce)
{
	canaleVoce.members.forEach(member =>
	{
		if(member.id==userID)
		{
			member.voice.kick();
		}
	});
}
function getRandomVoiceChannel()
{
	var channelReturn=null;
	var channelBackup=null;
	bot.channels.cache.forEach(channel => 
	{ 
		if(stringheUguali(channel.type,'voice'))
		{
			if(randomBoolean(DEFAULT_PROBABILITY))
				channelReturn=channel;
			channelBackup=channel;
		}
	});
	if(channelReturn)
		return channelReturn;
	else
		return channelBackup;
}
var numero;
function countDown(channel,start)
{
	numero=start+1;
	for(var i=0;i<start;i++)
	{
		setTimeout(function()
			{ 
				numero--;
				return inviaMessaggio(channel,numero); 
			}, 
		(i+1)*1000);
	}
}
function getVoiceChannelFromUserID(userID)
{
	var channelReturn=null;
	bot.channels.cache.forEach(channel => 
	{ 
		if(stringheUguali(channel.type,'voice'))
		{
			channel.members.forEach(user =>
			{
				if(user.id==userID)
					channelReturn=channel;
			});
		}
	});
	return channelReturn;
}
function channelToID(stringa)
{
	var channelID=stringa.substr(2).split('>')[0];
	return channelID;
}
function isDiscordChannel(stringa)
{
	if(stringa.startsWith('<#') && stringa.endsWith('>'))
		return true;
	else
		return false;
}
function stringaRicordi(userID)
{
	if(ricordi.numeroRicordi==0) return 'Nessun ricordo.';
	var qualcheRicordo=false;
	var messaggio='';
	for(var i=0;i<ricordi.numeroRicordi;i++)
	{
		if(ricordi[i].userID==userID)
		{
			var data=new Date(ricordi[i].data);
			var minutiVisualizzati=data.getMinutes();
			if(minutiVisualizzati<10)
				minutiVisualizzati='0'+data.getMinutes()
			messaggio+=(i+1)+')'+data.getHours()+':'+minutiVisualizzati+' '+data.getDate()+'/'+(data.getMonth()+1)+'/'+data.getFullYear()+' <@!'+ricordi[i].userID+'> '+ricordi[i].stringa+'\n';
			qualcheRicordo=true;
		}
	}
	if(!qualcheRicordo) return 'Nessun ricordo.';
	return messaggio;
}
function rimuoviRicordo(ricordo)
{
	var nuoviRicordi={};
	nuoviRicordi.numeroRicordi=0;
	for(var i=0;i<ricordi.numeroRicordi;i++)
	{
		if(ricordi[i]!=ricordo)
		{
			nuoviRicordi[nuoviRicordi.numeroRicordi]=ricordi[i];
			nuoviRicordi.numeroRicordi++;
		}
	}
	ricordi=nuoviRicordi;
}
function controllaRicordi()
{
	var dataCorrente=new Date();
	var canaleRicordi=getChannelFromChannelID(impostazioni.canaleRicordi);
	for(var i=0;i<ricordi.numeroRicordi;i++)
	{
		var data=new Date(ricordi[i].data);
		if(data<=dataCorrente)
		{
			inviaMessaggio(canaleRicordi,'<@!'+ricordi[i].userID+'> ti ricordo: '+ricordi[i].stringa);
			rimuoviRicordo(ricordi[i]);
			salvaRicordiSuFile();
		}
	}
}
function stringaCoppieTag()
{
	var messaggio='';
	for(var i=0;i<coppie.numeroCoppie;i++)
	{
		if(isDiscordTag(coppie[i].messaggio))
		{
			messaggio+=coppie[i].chiave+'\t'+coppie[i].messaggio+'\n';
		}
	}
	return messaggio;
}
function stringheUguali(stringa1,stringa2)
{
	return JSON.stringify(stringa1)==JSON.stringify(stringa2);
}
function coppiaPresente(chiave)
{
	for(var i=0;i<coppie.numeroCoppie;i++)
		if(stringheUguali(coppie[i].chiave,chiave))
			return true;
	return false;
}
function rimuoviCoppia(chiave)
{
	var nuoveCoppie={};
	nuoveCoppie.numeroCoppie=0;
	for(var i=0;i<coppie.numeroCoppie;i++)
	{
		if(!stringheUguali(coppie[i].chiave,chiave))
		{
			nuoveCoppie[nuoveCoppie.numeroCoppie]=coppie[i];
			nuoveCoppie.numeroCoppie++;
		}
	}
	coppie=nuoveCoppie;
}
function dataVecchia(data)
{
	var dataCorrente=new Date();
	if(data<=dataCorrente)
		return true;
	else
		return false;
}
function salvaRicordiSuFile()
{
	salvaOggettoSuFile(ricordi,fileRicordi);
}
function aggiungiRicordo(data,userID,stringa)
{
	var ricordo={};
	ricordo.data=data;
	ricordo.userID=userID;
	ricordo.stringa=stringa;
	ricordi[ricordi.numeroRicordi]=ricordo;
	ricordi.numeroRicordi++;
}
function annoBisestile(anno)
{
	return 
	(
		((anno%4==0) && (anno%100!=0)) || (anno%400==0)
	); 
}
function dataValida(ora,minuti,giorno,mese,anno)
{
	if(ora<0 || ora>24)
		return false;
	if(minuti<0 || minuti>60)
		return false;
	if(mese<0 || mese>12)
		return false;
	if(anno<MIN_YEAR)
		return false;
	
	//giorno
	if(giorno<0 || giorno>31)
		return false;
	if(mese==2)
	{
		if(annoBisestile(anno))
			if(giorno>29)
				return false;
		else 
			if(giorno>28)
				return false;
	}
	if (mese==4 || mese==6 || mese==9 || mese==11) 
        if(giorno>30)
			return false;
	return true;
}
function isNumber(numero)
{
	return !isNaN(numero);
}
function generaStringaDaParametri(parametri,numeroInizio)
{
	var stringa='';
	for(var i=numeroInizio;i<parametri.length;i++)
		stringa+=parametri[i]+' ';
	return stringa;
}
function numeroParametriMaggioreUgualeDi(parametri,numero)
{
	return parametri.length>=numero;
}
function salvaCoppieSuFile()
{
	salvaOggettoSuFile(coppie,fileCoppie);
}
function aggiungiCoppia(chiave,messaggio,probabilita)
{
	var coppia={};
	coppia.chiave=chiave;
	coppia.messaggio=messaggio;
	coppia.probabilita=probabilita;
	coppie[coppie.numeroCoppie]=coppia;
	coppie.numeroCoppie++;
}
function numeroParametri(parametri,numero)
{//ha esattamente <numero> parametri
	return parametri.length==numero;
}
function isDiscordTag(stringa)
{
	if(stringa.startsWith('<@!') && stringa.endsWith('>'))
		return true;
	else
		return false;
}
function tagToClientID(stringa)
{
	var userID=stringa.substr(3).split('>')[0];
	return userID;
}
function impostaCanaleRicordi(canale)
{
	impostazioni.canaleRicordi=canale.id;
}
function getChannelFromChannelID(channelID)
{
	var channelReturn=null;
	bot.channels.cache.forEach(channel => 
	{ 
		if(channel.id==channelID)
		{
			channelReturn=channel;
		}
	});
	return channelReturn;
}
function salvaImpostazioniSuFile()
{
	salvaOggettoSuFile(impostazioni,fileImpostazioni);
}
function salvaOggettoSuFile(oggeto,nomeFile)
{
	var oggetoJSON=JSON.stringify(oggeto);
	fs.writeFile(nomeFile,oggetoJSON,'utf8',
		(err) =>
		{
			if (err) throw err;
		}
	);
}
function rispostaHelp(channel)
{
	var risposta='';
	risposta+=aggiungiComandoHelp('help','Mostra una lista di comandi.');
	risposta+=aggiungiComandoHelp('kickRoulette','Sfida la sorte.');
	risposta+=aggiungiComandoHelp('aggiungiTag <tag> <nome>','Tagga una persona ogni volta che la nomini.');
	risposta+=aggiungiComandoHelp('rimuoviTag <nome>','Rimuove un tag rapido.');
	risposta+=aggiungiComandoHelp('mostraTag','Mostra tutti i tag.');
	risposta+=aggiungiComandoHelp('impostaCanaleRicordi','Imposta il canale dove ci saranno i ricordi.');
	risposta+=aggiungiComandoHelp('ricorda <ora> <giorno> <data> <anno> <promemoria>','Ti ricorda le cose.');
	risposta+=aggiungiComandoHelp('ricordaA <tag> <ora> <giorno> <data> <anno> <promemoria>','Ricorda le cose a chi tagghi.');
	risposta+=aggiungiComandoHelp('rimuoviRicordo <numero ricordo>','Rimuove un ricordo.');
	risposta+=aggiungiComandoHelp('mostraRicordi','Mostra tutti i ricordi.');
	inviaMessaggio(channel,risposta);
}
function aggiungiComandoHelp(comando,descrizione)
{
	return '**'+START_CHAR+comando+'**\t'+descrizione+'\n';
}
function rispondiErrore(channel)
{
	inviaMessaggio(channel,'Errore.');
}
function rispondiAlleParoleChiavi(channel,messaggioLetto)
{
	for(var i=0;i<coppie.numeroCoppie;i++)
	{
		var probabilita=DEFAULT_PROBABILITY;
		if(coppie[i].probabilita!=null) probabilita=coppie[i].probabilita;
		if(contiene(messaggioLetto,coppie[i].chiave) && randomBoolean(probabilita))
		{
			inviaMessaggio(channel, coppie[i].messaggio);
		}
	}
}
function randomBoolean(probabilita)
{
	if(probabilita==0) return true;
	else return (Math.floor(Math.random() * probabilita))==0;
}
function contiene(testo, cosaContiene)
{
	return testo.toUpperCase().includes(cosaContiene.toUpperCase());
}
function inviaMessaggio(canale, messaggio)
{
	canale.send(messaggio);
}
function caricaRicordi()
{
	try
	{
		var datiSulFile=fs.readFileSync(fileRicordi,'utf8');
		ricordi=JSON.parse(datiSulFile);
	}
	catch(err) 
	{
		ricordi.numeroRicordi=0;
	}
}
function caricaComplessita()
{
	try
	{
		var datiSulFile=fs.readFileSync(fileComplessita,'utf8');
		complessita=JSON.parse(datiSulFile);
	}
	catch(err) 
	{
		complessita.numeroComplessita=0;
	}
}
function caricaCoppie()
{
	try
	{
		var datiSulFile=fs.readFileSync(fileCoppie,'utf8');
		coppie=JSON.parse(datiSulFile);
	}
	catch(err) 
	{
		coppie.numeroCoppie=0;
	}
}

function caricaImpostazioni(){
	try
	{
		var datiSulFile=fs.readFileSync(fileImpostazioni,'utf8');
		impostazioni=JSON.parse(datiSulFile);
	}
	catch(err) 
	{
		impostazioni.canaleRicordi=0;
	}
}