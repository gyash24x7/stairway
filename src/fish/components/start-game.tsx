"use client";

import { startGame } from "@/fish/server/functions";
import { store } from "@/fish/store";
import type { DeckType, FishBookType } from "@/libs/fish/types";
import { Button } from "@/shared/primitives/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from "@/shared/primitives/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/primitives/select";
import { Spinner } from "@/shared/primitives/spinner";
import { useStore } from "@tanstack/react-store";
import { useState, useTransition } from "react";

export function StartGame() {
	const [ isPending, startTransition ] = useTransition();
	const gameId = useStore( store, state => state.id );

	const [ type, setType ] = useState<FishBookType>( "NORMAL" );
	const [ deckType, setDeckType ] = useState<DeckType>( 48 );
	const [ open, setOpen ] = useState( false );

	const handleStartGame = () => startTransition( async () => {
		await startGame( { gameId, type, deckType } );
		setOpen( false );
	} );

	return (
		<Dialog open={ open } onOpenChange={ setOpen }>
			<DialogTrigger asChild>
				<Button className={ "flex-1 max-w-lg" }>START GAME</Button>
			</DialogTrigger>
			<DialogContent className={ "w-full max-w-xl" }>
				<DialogHeader>
					<DialogTitle>START GAME</DialogTitle>
				</DialogHeader>
				<div className={ "flex flex-col gap-3" }>
					<Select
						value={ type.toString() }
						onValueChange={ ( value ) => setType( value as FishBookType ) }
					>
						<SelectTrigger className={ "w-full" }>
							<SelectValue placeholder={ "Select Deck Type" }/>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="NORMAL">Normal Fish, Books grouped by ranks of size 4</SelectItem>
							<SelectItem value="CANANDIAN">Canadian Fish, Books grouped by suits of size 6</SelectItem>
						</SelectContent>
					</Select>
					<Select
						value={ deckType.toString() }
						onValueChange={ ( value ) => setDeckType( parseInt( value ) as DeckType ) }
					>
						<SelectTrigger className={ "w-full" }>
							<SelectValue placeholder={ "Select Deck Type" }/>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="48">48 Cards, 7s Removed</SelectItem>
							<SelectItem value="52">52 Cards</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<DialogFooter>
					<Button onClick={ handleStartGame } disabled={ isPending } className={ "w-full" }>
						{ isPending ? <Spinner/> : "START GAME" }
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}