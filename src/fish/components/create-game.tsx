"use client";

import type { PlayerCount } from "@/fish/types";
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
import { Spinner } from "@/shared/primitives/spinner";
import { orpc } from "@/shared/utils/client";
import { cn } from "@/shared/utils/cn";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export function CreateGame() {
	const [ playerCount, setPlayerCount ] = useState<PlayerCount>();
	const [ open, setOpen ] = useState( false );
	const navigate = useNavigate();

	const { mutateAsync, isPending } = useMutation( orpc.fish.createGame.mutationOptions( {
		onSuccess: ( data ) => navigate( { to: `/fish/${ data.gameId }` } )
	} ) );

	const handleClick = () => mutateAsync( { playerCount } );

	return (
		<Dialog open={ open } onOpenChange={ setOpen }>
			<DialogTrigger className={ buttonVariants() }>CREATE GAME</DialogTrigger>
			<DialogContent className={ "w-full max-w-xl" }>
				<DialogHeader>
					<DialogTitle className={ "font-bold" }>CREATE GAME</DialogTitle>
					<DialogDescription/>
				</DialogHeader>
				<div className={ "flex flex-col gap-3" }>
					<h2>SELECT PLAYER COUNT</h2>
					<div className={ "flex gap-3 flex-wrap" }>
						{ ( [ 3, 4, 6, 8 ] as const ).map( ( item ) => (
							<div
								key={ item }
								onClick={ () => setPlayerCount( playerCount === item ? undefined : item ) }
								className={ cn(
									playerCount === item ? "bg-white" : "bg-bg",
									"cursor-pointer flex-1 rounded-md border-2 px-4 py-2 flex justify-center",
									"hover:bg-white"
								) }
							>
								{ item }
							</div>
						) ) }
					</div>
				</div>
				<DialogFooter>
					<Button onClick={ handleClick } disabled={ isPending } className={ "w-full" }>
						{ isPending ? <Spinner/> : "CREATE GAME" }
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}