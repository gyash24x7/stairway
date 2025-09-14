"use client";

import { orpc } from "@/app/client/orpc";
import { DisplayCardSuit } from "@/app/components/shared/display-card";
import { Button, buttonVariants } from "@/app/primitives/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from "@/app/primitives/dialog";
import { Spinner } from "@/app/primitives/spinner";
import type { CardSuit } from "@/utils/cards";
import { CARD_SUITS } from "@/utils/cards";
import { cn } from "@/utils/cn";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export function CreateGame() {
	const [ selectedSuit, setSelectedSuit ] = useState<CardSuit>();
	const [ dealCount, setDealCount ] = useState<5 | 9 | 13>();
	const [ open, setOpen ] = useState( false );
	const navigate = useNavigate();

	const { mutateAsync, isPending } = useMutation( orpc.callbreak.createGame.mutationOptions( {
		onSuccess: ( data ) => navigate( { to: `/callbreak/${ data.gameId }` } ),
		onError: ( err ) => alert( err.message ),
		onSettled: () => setOpen( false )
	} ) );

	const handleClick = () => mutateAsync( { trumpSuit: selectedSuit!, dealCount } );

	return (
		<Dialog open={ open } onOpenChange={ setOpen }>
			<DialogTrigger className={ buttonVariants() }>CREATE GAME</DialogTrigger>
			<DialogContent className={ "w-full max-w-xl" }>
				<DialogHeader>
					<DialogTitle>Create Game</DialogTitle>
					<DialogDescription/>
				</DialogHeader>
				<div className={ "flex flex-col gap-3" }>
					<h2>Select Trump Suit</h2>
					<div className={ "flex gap-3 flex-wrap" }>
						{ Object.values( CARD_SUITS ).map( ( item ) => (
							<div
								key={ item }
								onClick={ () => setSelectedSuit( selectedSuit === item ? undefined : item ) }
								className={ cn(
									selectedSuit === item ? "bg-white" : "bg-bg",
									"cursor-pointer flex-1 rounded-md border-2 px-4 py-2 flex justify-center",
									"hover:bg-white"
								) }
							>
								<DisplayCardSuit suit={ item }/>
							</div>
						) ) }
					</div>
					<h2>Select Number of Deals</h2>
					<div className={ "flex gap-3 flex-wrap" }>
						{ [ 5 as const, 9 as const, 13 as const ].map( ( item ) => (
							<div
								key={ item }
								onClick={ () => setDealCount( dealCount === item ? undefined : item ) }
								className={ cn(
									dealCount === item ? "bg-white" : "bg-bg",
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