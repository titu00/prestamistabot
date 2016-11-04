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
			'nombre': ['nombre','llamo','llaman','soy'],
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

// Limpia el plazo, retorna un moment.duration
var limpiarPlazo = function(valor) {
	valor = 'P'+valor
		.toLowerCase()
		.replace(' y ','')
		.replace(/[\s]+/g,'')
		.replace(/[^a-z0-9]/g,'')
		.replace(/([^\d])[^\d]+/g,'$1')
		.replace('a','y')
		.replace('s','w')
		.replace(/^[^0-9]+/g,'')
		.replace(/[0-9]+$/g,'')
		.toUpperCase();
	return moment.duration(valor);
};

// Limpia el monto, retorna un numerico
var limpiarMonto = function(valor) {
	var num = numeral().unformat(valor);
	valor = ' '+valor.toLowerCase()+' ';
	var unidades = {
			'cien':100,
			'cientos':100,
			'mil':1000,
			'miles':1000,
			'millones':1000000,
			'millon':1000000,
		};
	for(unit in unidades) {
		if( valor.match( new RegExp(' '+unit+' ') ) ) {
			num *= unidades[unit];
		}
	}
	return num;
};

var saveData = function(session,args,next) {

	console.log(" Intent: %s %d% ".white.bgMagenta, args.intent, Math.round(args.score*100) );

	// Obtiene concepto/valor pendiente o actual
	var foundConcept = builder.EntityRecognizer.findEntity( args.entities, 'concept' );
	if(!foundConcept) {
		foundConcept = session.userData._pending_concept;
	}
	session.userData._pending_concept = false;
	var foundValue = builder.EntityRecognizer.findEntity( args.entities, 'value' );
	if(!foundValue) {
		foundValue = session.userData._pending_value;
	}
	session.userData._pending_value = false;

	// Obtiene el intent anterior
	if(args.intent == 'None' && session.userData._pending_intent) {
		args.intent = session.userData._pending_intent;
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
						switch(key) {
							case 'monto':
							case 'ingresos':
							case 'egresos':
							case 'resultados':
							case 'patrimonio':
							case 'cuota':
								session.userData[args.intent][key] = limpiarMonto(foundValue.entity);
								break;
							case 'plazo':
								session.userData[args.intent][key] = limpiarPlazo(foundValue.entity);
								break;
							default:
								session.userData[args.intent][key] = foundValue.entity;
								break;
						}
						break;
					}
				}
			}
		} else {
			if(foundConcept) {
				session.send('Disculpa, no comprendi el valor de '+foundConcept.entity);
				session.userData._pending_intent = args.intent;
				session.userData._pending_concept = foundConcept;
				return;
			} else if(foundValue) {
				session.send('Disculpa, no entendi a que corresponde el valor '+foundValue.entity);
				session.userData._pending_intent = args.intent;
				session.userData._pending_value = foundValue;
				return;
			}
		} 
	}
	next(session,args,next);
};


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
		if(!session.userData.saludado && session.userData.nombre) {
			session.send('Hola %s',session.userData.nombre);
		} else {
			session.send('Registrado');
		}
	}
]);


/**
 * Retorna los datos que tiene guardados
 */
intents.matches('debug',[
	function(session,args,next) {
		var enviado = false;
		for(mode in session.userData) {
			if(!mode.match(/^_/)) {
				var vars = session.userData[mode];
				for(k in vars) {
					enviado = true;
					session.send('DEBUG: '+mode+' '+k+' => '+session.userData[mode][k]);
				}
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
		session.userData._saludado = true;
	}
]);


/**
 * El usuario se quiere contactar con un humano
 */
intents.matches('intent_humano',[
	function(session,args,next) {
		builder.Prompts.text(session, respuestas.intent_humano[Math.floor(Math.random()*respuestas.intent_humano.length)]);
		if(!session.userData.intent_datos.nombre) {
			builder.Prompts.text(session, respuestas.intent_datos.nombre[Math.floor(Math.random()*respuestas.intent_datos.nombre.length)]);
		} else {
			next({response: session.userData.intent_datos.nombre});
		}
	},
	function(session,results,next) {
		session.userData.intent_datos.nombre = results.response;
		if(
			session.userData.intent_datos.telefono && session.userData.intent_datos.email ||
			!session.userData.intent_datos.telefono && !session.userData.intent_datos.email
			) {
			builder.Prompts.text(session, "Como podemos contactarte? (telefono/email)");
		} else if(session.userData.intent_datos.telefono) {
			next({response: 'telefono'});
		} else if(session.userData.intent_datos.email) {
			next({response: 'email'});
		}
	},
	function(session,results,next) {
		if(results.response.toLowerCase().match('tel')) {
			session.userData._contact = 'telefono';
		} else if(results.response.toLowerCase().match(/(mail|corr)/)) {
			session.userData._contact = 'email';
		} else {
			session.send('No reconozco el medio');
			// TODO: Loop?
			return;
		}
		if( !session.userData.intent_datos[session.userData._contact] ) {
			builder.Prompts.text(session, 'Nos puedes pasar un '+session.userData._contact+' para contactarte?');
		} else {
			next({response: session.userData.intent_datos[session.userData._contact]});
		}
	},
	function(session,results,next) {
		session.userData.intent_datos[session.userData._contact] = results.response;
		session.send('%s, brevemente se estaran contactando contigo al %s',
			session.userData.intent_datos.nombre,
			results.response
			);
	}
]);


/**
 * Default (None)
 */
intents.onDefault([
	saveData,
	function(session,args,next) {
		for(resp of respuestas.None) {
			session.send(resp);
		}
	}
]);


