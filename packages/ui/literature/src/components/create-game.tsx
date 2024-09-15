"use client";

import { Button, Spinner } from "@base/ui";
import { redirect } from "next/navigation";
import { useServerAction } from "zsa-react";
import { createGameAction } from "../actions";

export function CreateGame() {
	const { isPending, execute } = useServerAction( createGameAction, {
		onSuccess( { data } ) {
			redirect( `/literature/${ data.id }` );
		}
	} );

	return (
		<Button onClick={ () => execute( { playerCount: 6 } ) }>
			{ isPending ? <Spinner/> : "CREATE GAME" }
		</Button>
	);
}