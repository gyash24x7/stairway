import { Button, buttonVariants } from "@s2h-ui/primitives/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from "@s2h-ui/primitives/dialog";
import { Spinner } from "@s2h-ui/primitives/spinner";
import { cn } from "@s2h-ui/primitives/utils";
import { usePurchaseCardMutation } from "@s2h/client/splendor";
import type { Gem, Tokens } from "@s2h/splendor/types";
import { DEFAULT_TOKENS } from "@s2h/splendor/utils";
import { useStore } from "@tanstack/react-store";
import { useState } from "react";
import { DisplayCard } from "./display-card.tsx";
import { handleCardDeSelect, store } from "./store.tsx";
import { gemColors, TokenPicker } from "./token-picker.tsx";

export function PurchaseCard() {
	const [ showDialog, setShowDialog ] = useState( false );
	const gameId = useStore( store, state => state.id );
	const selectedCard = useStore( store, state => {
		const selectedCardId = state.local.selectedCard;
		const cardFromBoard = Object.values( state.cards ).flat().find( card => card?.id === selectedCardId );
		const cardFromReserved = Object.values( state.players[ state.playerId ].reserved )
			.find( card => card?.id === selectedCardId );
		return cardFromBoard || cardFromReserved;
	} );

	const player = useStore( store, state => state.players[ state.playerId ] );
	const [ payment, setPayment ] = useState<Partial<Tokens>>( {} );

	const { mutateAsync, isPending } = usePurchaseCardMutation( {
		onSuccess: () => {
			setShowDialog( false );
			setPayment( DEFAULT_TOKENS );
			handleCardDeSelect();
		}
	} );

	const handleClick = () => mutateAsync( { gameId, cardId: selectedCard!.id, payment } );

	const reduceToPayment = ( pickedTokens: Partial<Tokens> ) => {
		setPayment( pickedTokens );
	};

	return (
		<Dialog open={ showDialog } onOpenChange={ setShowDialog }>
			<DialogTrigger className={ cn( buttonVariants(), "flex-1" ) } disabled={ !selectedCard }>
				PURCHASE CARD
			</DialogTrigger>
			<DialogContent>
				<div className={ "mx-auto w-full max-w-lg overscroll-y-auto" }>
					<DialogHeader>
						<DialogTitle className={ "text-center" }>PURCHASE CARD</DialogTitle>
						<DialogDescription/>
					</DialogHeader>
					<div className={ "flex flex-col gap-2 items-center mb-2" }>
						<div className={ "flex gap-2 justify-between w-full" }>
							{ selectedCard && <DisplayCard card={ selectedCard } disabled/> }
							<div>
								<h2 className={ "pb-1" }>Available Discounts</h2>
								<div className={ "flex gap-1" }>
									{ Object.keys( player.tokens )
										.map( g => g as Gem )
										.filter( g => g !== "gold" )
										.map( gem => (
											<div
												className={ cn( "w-10 h-16 p-1 rounded-md border bg-gray-400" ) }
												key={ gem }
											>
												<div className={ cn(
													"flex h-full rounded-md border items-center justify-center",
													"text-3xl text-neutral-dark",
													gemColors[ gem ]
												) }>
													<h2>{ player.cards.filter( c => c.bonus === gem ).length }</h2>
												</div>
											</div>
										) ) }
								</div>
							</div>
						</div>
						<h2>Select to tokens to pay with</h2>
						<div className={ `flex gap-2 border-2 rounded-md p-2 w-full` }>
							<TokenPicker initialTokens={ player.tokens } allowGold onPickChange={ reduceToPayment }/>
						</div>
					</div>
					<DialogFooter>
						<Button onClick={ handleClick } disabled={ isPending } className={ "flex-1" }>
							{ isPending ? <Spinner/> : "PURCHASE CARD" }
						</Button>
					</DialogFooter>
				</div>
			</DialogContent>
		</Dialog>
	);
}
