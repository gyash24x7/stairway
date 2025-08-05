"use client";

import { joinGame } from "@/fish/server/functions";
import { Button } from "@/shared/primitives/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
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
		const { error, data } = await joinGame( { code } );
		if ( !error && !!data ) {
			window.location.href = `/literature/${ data }`;
		}
	} );

	return (
		<Dialog>
			<DialogTrigger>
				<Button>JOIN GAME</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle className={ "font-bold" }>JOIN GAME</DialogTitle>
					<DialogDescription/>
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