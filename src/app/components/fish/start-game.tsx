"use client";

import { orpc } from "@/app/client/orpc";
import { store } from "@/app/components/fish/store";
import { Button } from "@/app/primitives/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/app/primitives/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectSeparator,
	SelectTrigger,
	SelectValue
} from "@/app/primitives/select";
import { Spinner } from "@/app/primitives/spinner";
import type { BookType, DeckType } from "@/workers/fish/types";
import { useMutation } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { useState } from "react";

export function StartGame() {
	const gameId = useStore( store, state => state.id );

	const [ type, setType ] = useState<BookType>( "NORMAL" );
	const [ deckType, setDeckType ] = useState<DeckType>( 48 );
	const [ open, setOpen ] = useState( false );

	const { mutateAsync, isPending } = useMutation( orpc.fish.startGame.mutationOptions( {
		onSuccess: () => setOpen( false )
	} ) );

	const handleStartGame = () => mutateAsync( { gameId, type, deckType } );

	return (
		<Dialog open={ open } onOpenChange={ setOpen }>
			<DialogTrigger>
				<Button className={ "flex-1 max-w-lg" }>START GAME</Button>
			</DialogTrigger>
			<DialogContent className={ "w-full max-w-xl" }>
				<DialogHeader>
					<DialogTitle>START GAME</DialogTitle>
				</DialogHeader>
				<div className={ "flex flex-col gap-3" }>
					<Select
						value={ type.toString() }
						onValueChange={ ( value ) => setType( value as BookType ) }
					>
						<SelectTrigger className={ "w-full" }>
							<SelectValue/>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="NORMAL">Normal Fish, Books grouped by ranks of size 4</SelectItem>
							<SelectSeparator/>
							<SelectItem value="CANANDIAN">Canadian Fish, Books grouped by suits of size 6</SelectItem>
						</SelectContent>
					</Select>
					<Select
						value={ deckType.toString() }
						onValueChange={ ( value ) => setDeckType( parseInt( value ) as DeckType ) }
					>
						<SelectTrigger className={ "w-full" }>
							<SelectValue/>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="48">48 Cards, 7s Removed</SelectItem>
							<SelectSeparator/>
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