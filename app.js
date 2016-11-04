// Requires
var restify = require('restify');
var builder = require('botbuilder');
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
var recognizer = new builder.LuisRecognizer(
		'https://api.projectoxford.ai/luis/v1/application?id=4b828775-9a0d-4416-b7ba-117eab8007ab&subscription-key=b577b9b73d7c4ac89affaa1f08af1ff8'
	);
var intents = new builder.IntentDialog({ recognizers: [recognizer] });
bot.dialog('/', intents);


// Corre al empezar
intents.onBegin(function (session, args, next) {
//	session.send('Hola');
    next();
});


var respuestas = {
		'intent_datos': {
			'razon': [
				'Estaria necesitando la razon social',
				'Necesito la razon social',
			],
			'cuit': [
				'Necesito el CUIT',
			],
			'telefono': [
				'Cual es su telefono?',
			],
			'email': [
				'Me puede pasar su correo electronico?'
			],
			'nombre': [
				'Como puedo llamarle?'
			]
		},
		'intent_balance': {
			'periodo': [
				'Cual es tu ultimo periodo',
				'De que anio estamos hablando?',
			],
			'resultados': [
				'Cuales fueron tus resultados netos del ultimo periodo?',
			],
			'ingresos': [
				'Cuales fueron los ingresos?',
				'Que monto de ventas manejaron?',
			],
			'egresos': [
				'Cuantos fueron los gastos?',
				'De cuanto fueron los egresos?',
			],
			'patrimonio': [
				'Cuanto es el patrimonio de la empresa?',
			]
		},
		'intent_prestamo': {
			'monto': [
				'Cual es el monto deseado del prestamo?',
				'Cuanto necesitas de prestamo?',
			],
			'plazo': [
				'Por cuanto tiempo?',
				'Por cuantos dias?',
				'En cuanto tiempo quieres pagarlo?',
			],
			'cuota': [
				'De cuanto deseas que sea tu cuota?',
			],
			'tasa': [
				'Que tasa estas buscando?',
			],
		},
		'intent_humano': [
			'Disculpa que no sea de tu agrado, te transfiero con mi supervisor humano',
			'Te estoy pasando con una persona real',
		],
		'intent_saludo': [
			'Hola, soy una asistente virtual para prestamos. En que te puedo ayudar hoy?',
			'Hola, soy tu asistente virtual para prestamos, como puedo ayudarte hoy?',
			'Hola, estoy para ayudarte a obtener un prestamo',
		],
		'None': [
			'Disculpa, pero no te entiendo',
			"Puedes probar decirme 'Quiero un prestamo de ... a ... dias'",
		]
	};
var taxonomyKeys = {
		'intent_datos': {
			'razon': ['razon','razon social','empresa'],
			'cuit': ['cuit','c.u.i.t.'],
			'telefono': ['tel','telefono','fono','numero'],
			'email': ['email','mail','correo','correo electronico','direccion'],
			'nombre': ['nombre','llamo'],
		},
		'intent_balance': {
			'resultados': ['resultados','ganancias','resultados netos','patrimonio'],
			'periodo': ['periodo','periodo fiscal'],
			'ingresos': ['ingresos','ventas','facturacion','facturamos','facture','factura','vendimos'],
			'egresos': ['egresos','gastos'],
			'patrimonio': ['patrimonio','patromonio neto','patrimonio positivo','patrimonio negativo'],
		},
		'intent_prestamo': {
			'monto': ['monto','valor','prestamo'],
			'plazo': ['plazo','duracion'],
			'cuota': ['cuota','mensual','mensualmente'],
			'tasa': ['tasa','tna','interes']
		}
	};

var saveData = function(session,args,next) {

	console.log(" Intent: %s %d% ".white.bgMagenta, args.intent, Math.round(args.score*100) );

	// Obtiene concepto/valor pendiente o actual
	var foundConcept = builder.EntityRecognizer.findEntity( args.entities, 'concept' );
	if(!foundConcept) {
		foundConcept = session.userData.pending_concept;
	}
	session.userData.pending_concept = false;
	var foundValue = builder.EntityRecognizer.findEntity( args.entities, 'value' );
	if(!foundValue) {
		foundValue = session.userData.pending_value;
	}
	session.userData.pending_value = false;

	// Obtiene el intent anterior
	if(args.intent == 'None' && session.userData.pending_intent) {
		args.intent = session.userData.pending_intent;
	}

	if(args.intent && taxonomyKeys[args.intent]) {
		if(foundConcept && foundValue) {
			// TODO: Manejar cuando no encuentra el valor
			for(key in taxonomyKeys[args.intent]) {
				var concepts = taxonomyKeys[args.intent][key];
				for(concept of concepts) {
					if(foundConcept.entity.toLowerCase() == concept) {
						if(typeof session.userData[args.intent] == 'undefined') {
							session.userData[args.intent] = {};
						}
						// TODO: Aca debe haber alguna limpieza de los datos, pero depende del tipo de datos...
						session.userData[args.intent][key] = foundValue.entity;
						break;
					}
				}
			}
		} else {
			if(foundConcept) {
				session.send('Disculpa, no comprendi el valor de '+foundConcept.entity);
				session.userData.pending_intent = args.intent;
				session.userData.pending_concept = foundConcept;
				return;
			} else if(foundValue) {
				session.send('Disculpa, no entendi a que corresponde el valor '+foundValue.entity);
				session.userData.pending_intent = args.intent;
				session.userData.pending_value = foundValue;
				return;
			}
		} 
	}
	next(session,args,next);
};

/*
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
*/


/**
 * Solicita un prestamo
 */
intents.matches('intent_prestamo',[
	saveData,
	function(session,args,next) {
		session.send('Entiendo que quieres un prestamo');
	}
]);


/**
 * Carga los datos de un balance
 */
intents.matches('intent_balance',[
	saveData,
	function(session,args,next) {
		session.send('Entiendo que me estas pasando los datos del balance');
	}
]);


/**
 * Carga los datos de la empresa/usuario
 */
intents.matches('intent_datos',[
	saveData,
	function(session,args,next) {
		session.send('Entiendo que me estas pasando tus datos');
	}
]);


/**
 * Retorna los datos que tiene guardados
 */
intents.matches('debug',[
	function(session,args,next) {
		var enviado = false;
		for(mode in session.userData) {
			var vars = session.userData[mode];
			for(k in vars) {
				enviado = true;
				session.send('DEBUG: '+mode+' '+k+' => '+session.userData[mode][k]);
			}
		}
		if(!enviado) {
			session.send('DEBUG: Esta sesion no tiene datos');
		}
	}
]);


/** 
 * Saludo
 */
intents.matches('intent_saludo',[
	function(session,args,next) {
		var max = respuestas.intent_saludo.length;
		var rand = Math.floor( Math.random() * max );
		session.send( respuestas.intent_saludo[rand] );
	}
]);


/**
 * El usuario se quiere contactar con un humano
 */
intents.matches('intent_humano',[
	function(session,args,next) {
		var max = respuestas.intent_saludo.length;
		var rand = Math.floor( Math.random() * max );
		session.send( respuestas.intent_humano[rand] );
	}
]);

/*
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
*/

intents.onDefault([
	saveData,
	function(session,args,next) {
		for(resp of respuestas.None) {
			session.send(resp);
		}
	}
]);


