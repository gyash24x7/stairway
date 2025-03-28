"use client";

import { Button } from "@/components/base/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from "@/components/base/dialog";
import { Input } from "@/components/base/input";
import { Spinner } from "@/components/base/spinner";
import { joinGame } from "@/server/callbreak/functions";
import { redirect } from "next/navigation";
import { useState, useTransition } from "react";

export function JoinGame() {
	const [ isPending, startTransition ] = useTransition();
	const [ code, setCode ] = useState( "" );

	const handleClick = () => startTransition( async () => {
		const game = await joinGame( { code } );
		redirect( `/callbreak/${ game.id }` );
	} );

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button>JOIN GAME</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle className={ "text-xl text-center" }>Join Game</DialogTitle>
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