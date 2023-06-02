import { client } from "./client";

export async function getGameQueryFn( gameId: string ) {
	return client.getGame.query( { gameId } );
}

export async function meQueryFn() {
	return fetch( `http://localhost:8000/api/me`, { credentials: "include" } )
		.then( res => res.json() )
		.catch( () => null );
}
