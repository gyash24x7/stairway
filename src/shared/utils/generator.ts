import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Str from "effect/String";

import { names, uniqueNamesGenerator } from "unique-names-generator";


const GAME_CODE_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const AVATAR_BASE_URL = "https://api.dicebear.com/7.x/open-peeps/png?seed=";

export class Generator extends Context.Service<Generator, {
	readonly generateId: () => Effect.Effect<string>;
	readonly generateName: ( seed?: string ) => Effect.Effect<string>;
	readonly generateAvatar: ( seed?: string ) => Effect.Effect<string>;
	readonly generateCode: ( length?: number ) => Effect.Effect<string>;
}>()( "stairway/Generator" ) {}

export const GeneratorLive = Layer.effect( Generator, Effect.gen( function* () {
	const crypto = yield* Crypto.Crypto;
	const namesGenerator = ( length: number, seed: string ) =>
		uniqueNamesGenerator( { separator: " ", dictionaries: [ names ], length, seed } );

	return Generator.of( {
		generateId: () => crypto.randomUUIDv7.pipe( Effect.orDie ),
		generateName: ( seed = "" ) => Effect.succeed( namesGenerator( 1, seed ) ),
		generateAvatar: ( seed = "" ) => Effect.succeed(
			Str.concat( AVATAR_BASE_URL, encodeURIComponent( seed ) )
		),
		generateCode: ( length = 6 ) => Effect.gen( function* () {
			let code = "";
			for ( let i = 0; i < length; i++ ) {
				const index = yield* crypto.randomIntBetween(
					0,
					GAME_CODE_ALPHABET.length,
					{ halfOpen: true }
				);
				code += GAME_CODE_ALPHABET[ index ]!;
			}

			return code;
		} )
	} );
} ) );
