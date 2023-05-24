import { GetGameInput } from "@s2h/literature/dtos";
import { db } from "@s2h/utils";
import { observable } from "@trpc/server/observable";
import * as console from "node:console";
import { LitSubscriptionResolver } from "../utils";

export function subscribeGame(): LitSubscriptionResolver<GetGameInput, string> {
	return ( { ctx } ) => observable<string>( emit => {
		let closeFn = () => { };

		db.literature().changes().run( ctx.connection )
			.then( async cursor => {
				closeFn = () => cursor.close();
				const { new_val, old_val, error } = await cursor.next();
				console.log( new_val );
				console.log( old_val );
				console.log( error );
				emit.next( new_val!.id );
			} )
			.catch( err => {
				console.log( err );
			} );

		return closeFn;
	} );
}