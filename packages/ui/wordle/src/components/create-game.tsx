"use client";

import { Button, Spinner } from "@base/ui";
import { redirect } from "next/navigation";
import { useServerAction } from "zsa-react";
import { createGameAction } from "../actions";

export function CreateGame() {
	const { isPending, execute } = useServerAction( createGameAction, {
		onSuccess( { data } ) {
			redirect( `/wordle/${ data.id }` );
		}
	} );

	return (
		<Button onClick={ () => execute( { wordCount: 4 } ) }>
			{ isPending ? <Spinner/> : "CREATE GAME" }
		</Button>
	);
}