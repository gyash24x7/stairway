import crossws from "crossws/adapters/bun";
import redis from "redis";

const redisHost = process.env[ "REDIS_HOST" ] ?? "localhost";
const redisPort = parseInt( process.env[ "REDIS_PORT" ] ?? "6379" );

let client = redis.createClient( {
	url: `redis://${ redisHost }:${ redisPort }`
} );

await client.connect();

await client.subscribe( "literature-event", ( message ) => {
	const data: GameEventMessage = JSON.parse( message );

	const topic = !!data.playerId
		? `literature-${ data.gameId }-${ data.playerId }`
		: `literature-${ data.gameId }`;

	const payload = { type: data.event, data: data.data };

	console.log( "Publishing to", topic, payload );
	ws.publish( topic, payload );
} );

await client.subscribe( "callbreak-event", ( message ) => {
	const data: GameEventMessage = JSON.parse( message );

	const topic = !!data.playerId
		? `callbreak-${ data.gameId }-${ data.playerId }`
		: `callbreak-${ data.gameId }`;

	const payload = { type: data.event, data: data.data };

	console.log( "Publishing to", topic, payload );
	ws.publish( topic, payload );
} );

export type JoinGameEventMessage = {
	type: "literature" | "callbreak";
	gameId: string;
	playerId: string;
}

export type GameEventMessage = {
	gameId: string;
	event: string;
	playerId?: string;
	data: any;
}

const ws = crossws( {
	hooks: {
		open( peer ) {
			console.log( "[ws] open", peer.id );
		},

		async message( peer, message ) {
			console.log( "[ws] message", peer.id, message );
			const data = message.json<JoinGameEventMessage>();
			if ( data.type === "literature" ) {
				peer.subscribe( `literature-${ data.gameId }` );
				peer.subscribe( `literature-${ data.gameId }-${ data.playerId }` );
			}

			if ( data.type === "callbreak" ) {
				peer.subscribe( `callbreak-${ data.gameId }` );
				peer.subscribe( `callbreak-${ data.gameId }-${ data.playerId }` );
			}
		},

		close( peer, event ) {
			console.log( "[ws] close", peer.id, event );
		},

		error( peer, error ) {
			console.log( "[ws] error", peer.id, error );
		}
	}
} );

Bun.serve( {
	port: 8000,
	websocket: ws.websocket,
	fetch( request, server ) {
		if ( request.headers.get( "upgrade" ) === "websocket" ) {
			return ws.handleUpgrade( request, server );
		}
		return new Response( null, { status: 200 } );
	}
} );
