"use client";

import { Button, buttonVariants } from "@/shared/primitives/button";
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
import { orpc } from "@/shared/utils/client";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export function JoinGame() {
	const [ code, setCode ] = useState( "" );
	const navigate = useNavigate();
	const { mutateAsync, isPending } = useMutation( orpc.fish.joinGame.mutationOptions( {
		onSuccess: ( data ) => navigate( { to: `/fish/${ data.gameId }` } )
	} ) );

	const handleJoinGame = () => mutateAsync( { code } );

	return (
		<Dialog>
			<DialogTrigger className={ buttonVariants() }>JOIN GAME</DialogTrigger>
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