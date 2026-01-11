import { Button } from "@s2h-ui/primitives/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "@s2h-ui/primitives/dialog";
import { Spinner } from "@s2h-ui/primitives/spinner";
import { useReserveCardMutation } from "@s2h/client/splendor";
import type { Gem } from "@s2h/splendor/types";
import { useStore } from "@tanstack/react-store";
import { Fragment } from "react";
import { useBoolean } from "usehooks-ts";
import { handleCardDeSelect, handleSelectedReturnTokenChange, store } from "./store.tsx";
import { TokenPicker } from "./token-picker.tsx";

export function ReserveCard() {
	const gameId = useStore( store, state => state.id );
	const withGold = useStore( store, state => state.tokens.gold > 0 );
	const selectedCardId = useStore( store, state => state.local.selectedCard );
	const selectedReturnTokens = useStore( store, state => state.local.selectedReturnTokens );

	const combinedTokens = useStore( store, state => {
		const combined = { ...state.players[ state.playerId ].tokens };
		if ( withGold ) {
			combined.gold = ( combined.gold || 0 ) + 1;
		}
		return combined;
	} );

	const combinedCount = Object.values( combinedTokens ).reduce( ( sum, val ) => sum + ( val || 0 ), 0 );
	const { value, toggle, setTrue, setFalse } = useBoolean( false );

	const { mutateAsync, isPending } = useReserveCardMutation( {
		onSuccess: () => {
			handleCardDeSelect();
			setFalse();
		}
	} );

	const handleReserveClick = async () => {
		if ( withGold && combinedCount > 10 ) {
			setTrue();
		} else {
			await mutateAsync( { gameId, cardId: selectedCardId!, withGold } );
		}
	};

	const handleReturnClick = async () => {
		const returnedTokens = Object.keys( selectedReturnTokens )
			.map( g => g as Gem )
			.filter( g => ( selectedReturnTokens[ g ] ?? 0 ) > 0 );

		await mutateAsync( { gameId, cardId: selectedCardId!, withGold, returnedToken: returnedTokens[ 0 ] } );
	};

	return (
		<Fragment>
			<Button onClick={ handleReserveClick } disabled={ isPending || !selectedCardId } className={ "flex-1" }>
				{ isPending ? <Spinner/> : "RESERVE CARD" }
			</Button>
			<Dialog open={ value } onOpenChange={ toggle }>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className={ "font-bold" }>RETURN TOKENS</DialogTitle>
						<DialogDescription/>
					</DialogHeader>
					<TokenPicker
						initialTokens={ combinedTokens }
						pickLimit={ 1 }
						onPickChange={ handleSelectedReturnTokenChange }
						allowGold={ withGold }
					/>
					<DialogFooter>
						<Button onClick={ handleReturnClick } disabled={ isPending } className={ "w-full" }>
							{ isPending ? <Spinner/> : "RETURN TOKENS" }
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Fragment>
	);
}