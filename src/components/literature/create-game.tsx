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
import { Spinner } from "@/components/base/spinner";
import { createGame } from "@/server/literature/functions";
import { cn } from "@/utils/cn";
import { redirect } from "next/navigation";
import { useState, useTransition } from "react";

export function CreateGame() {
	const [ isPending, startTransition ] = useTransition();
	const [ playerCount, setPlayerCount ] = useState<2 | 4 | 6 | 8>();
	const [ open, setOpen ] = useState( false );

	const handleClick = () => startTransition( async () => {
		const game = await createGame( { playerCount } );
		redirect( `/literature/${ game.id }` );
	} );

	return (
		<Dialog open={ open } onOpenChange={ setOpen }>
			<DialogTrigger asChild>
				<Button>CREATE GAME</Button>
			</DialogTrigger>
			<DialogContent className={ "w-full max-w-xl" }>
				<DialogHeader>
					<DialogTitle>CREATE GAME</DialogTitle>
				</DialogHeader>
				<div className={ "flex flex-col gap-3" }>
					<h2>SELECT PLAYER COUNT</h2>
					<div className={ "flex gap-3 flex-wrap" }>
						{ [ 2 as const, 4 as const, 6 as const, 8 as const ].map( ( item ) => (
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