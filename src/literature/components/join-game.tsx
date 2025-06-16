"use client";

import { joinGame } from "@/literature/server/functions";
import { Button } from "@/shared/primitives/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from "@/shared/primitives/dialog";
import { Input } from "@/shared/primitives/input";
import { Spinner } from "@/shared/primitives/spinner";
import { useState, useTransition } from "react";

export function JoinGame() {
	const [ code, setCode ] = useState( "" );
	const [ isPending, startTransition ] = useTransition();

	const handleJoinGame = () => startTransition( async () => {
		const [ err, game ] = await joinGame( { code } );
		if ( !err && game ) {
			window.location.href = `/literature/${ game.id }`;
		}
	} );

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button>JOIN GAME</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle className={ "font-bold" }>JOIN GAME</DialogTitle>
				</DialogHeader>
				<Input
					name={ "code" }
					placeholder={ "Enter Game Code" }
					value={ code }
					onChange={ ( e ) => setCode( e.target.value ) }
				/>
				<DialogFooter>
					<Button onClick={ handleJoinGame } disabled={ isPending } className={ "w-full" }>
						{ isPending ? <Spinner/> : "JOIN GAME" }
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}