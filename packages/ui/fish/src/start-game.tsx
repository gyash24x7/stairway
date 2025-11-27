import { Button } from "@s2h-ui/primitives/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from "@s2h-ui/primitives/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectSeparator,
	SelectTrigger,
	SelectValue
} from "@s2h-ui/primitives/select";
import { Spinner } from "@s2h-ui/primitives/spinner";
import { useStartGameMutation } from "@s2h/client/fish";
import type { BookType, DeckType } from "@s2h/fish/types";
import { useStore } from "@tanstack/react-store";
import { useState } from "react";
import { store } from "./store";

export function StartGame() {
	const gameId = useStore( store, state => state.id );

	const [ type, setType ] = useState<BookType>( "NORMAL" );
	const [ deckType, setDeckType ] = useState<DeckType>( 48 );
	const [ open, setOpen ] = useState( false );

	const { mutateAsync, isPending } = useStartGameMutation( {
		onSuccess: () => setOpen( false )
	} );

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