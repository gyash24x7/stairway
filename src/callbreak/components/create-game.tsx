"use client";

import { createGame } from "@/callbreak/server/functions";
import { CARD_SUITS } from "@/libs/cards/constants";
import type { CardSuit } from "@/libs/cards/types";
import { DisplayCardSuit } from "@/shared/components/display-card";
import { Button } from "@/shared/primitives/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from "@/shared/primitives/dialog";
import { Spinner } from "@/shared/primitives/spinner";
import { cn } from "@/shared/utils/cn";
import { useState, useTransition } from "react";

export function CreateGame() {
	const [ isPending, startTransition ] = useTransition();
	const [ selectedSuit, setSelectedSuit ] = useState<CardSuit>();
	const [ dealCount, setDealCount ] = useState<5 | 9 | 13>();
	const [ open, setOpen ] = useState( false );

	const handleClick = () => startTransition( async () => {
		const { error, data } = await createGame( { trumpSuit: selectedSuit!, dealCount } );
		if ( !error && !!data ) {
			window.location.href = `/callbreak/${ data.id }`;
		} else {
			alert( error );
		}
	} );

	return (
		<Dialog open={ open } onOpenChange={ setOpen }>
			<DialogTrigger asChild>
				<Button>CREATE GAME</Button>
			</DialogTrigger>
			<DialogContent className={ "w-full max-w-xl" }>
				<DialogHeader>
					<DialogTitle>Create Game</DialogTitle>
				</DialogHeader>
				<div className={ "flex flex-col gap-3" }>
					<h2>Select Trump Suit</h2>
					<div className={ "flex gap-3 flex-wrap" }>
						{ CARD_SUITS.map( ( item ) => (
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