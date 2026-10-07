import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { Generator } from "@/shared/utils/generator";


/**
 * A `Generator` that counts instead of rolling.
 *
 * This is what makes a game reproducible. The engine seeds every draw with
 * `makeRng( record.id, cursor, salt )` (`src/swish/server/engine.ts:552`) and
 * the record's id is whatever `generateId` returned first — so fixing the ids
 * fixes every shuffle, every deal and every card a challenge turns over.
 *
 * Ids are prefixed per stub rather than globally sequential, so two tables in
 * the same file cannot end up sharing an entity id and, through it, a deal.
 *
 * @param prefix - Namespace for this stub's ids; use the test's own name.
 * @returns The layer, and the ids handed out so far.
 */
export const makeTestGenerator = ( prefix: string ) => {
	const issued: Array<string> = [];

	const next = () => {
		const id = `${ prefix }-${ issued.length + 1 }`;
		issued.push( id );
		return id;
	};

	const layer = Layer.succeed( Generator, Generator.of( {
		generateId: () => Effect.sync( next ),
		generateName: ( seed = "" ) => Effect.succeed( `Bot ${ seed || issued.length }` ),
		generateAvatar: ( seed = "" ) => Effect.succeed( `avatar://${ seed || "anon" }` ),
		generateCode: ( length = 6 ) => Effect.sync(
			() => next().toUpperCase().replaceAll( "-", "" ).padEnd( length, "0" ).slice( 0, length )
		)
	} ) );

	return { layer, issued: () => [ ...issued ] } as const;
};
