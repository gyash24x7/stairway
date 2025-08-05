"use client";

import { joinGame } from "@/callbreak/server/functions";
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
	const [ isPending, startTransition ] = useTransition();
	const [ code, setCode ] = useState( "" );

	const handleClick = () => startTransition( async () => {
		const { error, data } = await joinGame( { code } );
		if ( !error && !!data ) {
			window.location.href = `/callbreak/${ data }`;
		} else {
			alert( error );
		}
	} );

	return (
		<Dialog>
			<DialogTrigger>
				<Button>JOIN GAME</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle className={ "text-xl text-center" }>Join Game</DialogTitle>
					<DialogDescription/>
				</DialogHeader>
				<Input
					name={ "code" }
					placeholder={ "Enter Game Code" }
					value={ code }
					onChange={ ( e ) => setCode( e.target.value ) }
				/>
				<DialogFooter>
					<Button onClick={ handleClick } disabled={ isPending } className={ "w-full" }>
						{ isPending ? <Spinner/> : "JOIN GAME" }
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}