// Microsoft
var restify = require('restify');
var builder = require('botbuilder');

// Utilidades
var colors = require('colors');
var numeral = require('numeral');
var moment = require('moment');
// TODO: Doesnt work, stupid acutes... moment.locale('es');

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
  
// Create chat bot
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());

// Dialogs
// TODO: Pasar a una var
var recognizer = new builder.LuisRecognizer('https://api.projectoxford.ai/luis/v1/application?id=90f6d036-f6e9-45ca-ad29-1384eb731b31&subscription-key=b577b9b73d7c4ac89affaa1f08af1ff8');
var intents = new builder.IntentDialog({ recognizers: [recognizer] });
bot.dialog('/', intents);


/*
// Corre al empezar
intents.onBegin(function (session, args, next) {
    next();
});
*/

// Guarda y procesa los datos
var middleProc = function(session,args,next) {
	var keys = ['nombre','proposito','correo','monto','telefono','plazo'];
	for(key of keys) {
		var tmp = builder.EntityRecognizer.findEntity(args.entities, key);
		// TODO: Usar findBestMatch https://docs.botframework.com/en-us/node/builder/chat/IntentDialog/#navtitle
		if(tmp) {
			session.userData[key] = tmp.entity;
		}
	}
	console.log(" Intent: %s %d% ".white.bgRed, args.intent, Math.round(args.score*100) );
	console.log(" -- Session data start -- ".blue);
	console.log(session.userData);
	console.log(" -- Session data end -- ".blue);
	next(session,args,next);
};


// Calcula el plazo
var calcPlazo = function(plazo) {
	// Viene dirty
	var parts = plazo.split(' ');
	var unit = 'days';
	switch(parts[1]) {
		case 'dias':
		case 'dia':
			// TODO: Do not touch? or set unit false and return unrecognized
			break;
		case 'meses':
		case 'mes':
			unit = 'months';
			break;
		case 'anios':
		case 'anio':
		case 'anos':
		case 'ano':
			unit = 'years';
			break;
	}
	return moment.duration(parseInt(parts[0]),unit);
}

// Calcula el prestamo 
var calcPrestamo = function(plazo, monto, tasa) {
	var plazo_clean = calcPlazo(plazo);
	var monto_clean = numeral().unformat(monto);
	var res = {
		plazo: plazo_clean.asDays(),
		monto: monto_clean
	};
	// TODO: Levantar el interes de API
	res.tasa = 0.2;
	res.cuota_cant = Math.ceil( res.plazo / 30);
	// TODO: Sistema frances, etc.
	res.cuota_valor = ( res.monto * (1+res.tasa) ) / res.cuota_cant;
	return	res;
};


// Imprime el prestam
var imprimePrestamo = function(session,results) {
	var prestamo = calcPrestamo(session.userData.plazo, session.userData.monto );
	if(session.userData.nombre) {
		session.send(
			"%s, para tu prestamo de %s a %d dias, te quedan %d cuotas de %.2f con un TNA %.2f",
			session.userData.nombre,
			prestamo.monto,
			prestamo.plazo,
			prestamo.cuota_cant,
			prestamo.cuota_valor,
			prestamo.tasa*100
		);
	} else {
		session.send(
			"Para tu prestamo de %s a %d dias, te quedan %d cuotas de %.2f con un TNA %.2f",
			prestamo.monto,
			prestamo.plazo,
			prestamo.cuota_cant,
			prestamo.cuota_valor,
			prestamo.tasa*100
		);
	}
};


/**
 * Solicita un prestamo
 */
intents.matches('intent_prestamo',[
	saveData,
	function(session,args,next) {
	}
]);

/**
 * Carga los datos de un balance
 */
intents.matches('intent_balance',[
	saveData,
	function(session,args,next) {
	}
]);

/**
 * Carga los datos de la empresa/usuario
 */
intents.matches('intent_datos',[
	saveData,
	function(session,args,next) {
	}
]);


intents.matches('saludo_intent', [
	middleProc,
    function (session, args, next) {
		session.send("Hola%s, soy tu asistente virtual para préstamos",session.userData.nombe? ' '+session.userData.nombre:'');
		// TODO: No guardar plazo/monto, sino que permitir guardar varios
		// TODO: Procesar el plazo antes de escupir
    }
]);

intents.matches('intent_prestamo',[
	middleProc,
	function(session,args,next) {
		if(
			!session.userData.monto
			||
			!session.userData.plazo
			) {
			var str = "Puedo ayudarte con eso, pero necesito:";
			if(!session.userData.monto)
				str+= "\n- Monto";
			if(!session.userData.plazo)
				str+= "\n- Plazo";
			session.send(str);
		} else {
			next({
				monto: session.userData.monto,
				plazo: session.userData.plazo
			});
		}
	},
	imprimePrestamo
]);
intents.matches('intent_contacto',[
	middleProc,
	function(session,args,next) {
		console.log(args);
		session.send('Queres que te contacte');
	}
]);
intents.matches('intent_terminos',[
	middleProc,
	function(session,args,next) {
		next({
			monto: session.userData.monto,
			plazo: session.userData.plazo
		});
	},
	imprimePrestamo
]);

intents.onDefault([
	middleProc,
	function(session,args,next) {
		// console.log(args);
		// TODO: Levantar los matches para ofrecer
		session.send('Disculpa, pero no te entiendo');
	}
]);


