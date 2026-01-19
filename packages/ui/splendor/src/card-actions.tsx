import { Button } from "@s2h-ui/primitives/button";
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
import { usePurchaseCardMutation, useReserveCardMutation } from "@s2h/client/splendor";
import type { Card, Cost, Gem, Tokens } from "@s2h/splendor/types";
import { useStore } from "@tanstack/react-store";
import { Fragment, useState } from "react";
import { GameCard } from "./game-card.tsx";
import { store } from "./store.tsx";
import { gemLightColors, TokenPicker } from "./token-picker.tsx";

type CardActionsMenuProps = {
	card: Card;
}

export function CardActions( props: CardActionsMenuProps ) {
	const [ type, setType ] = useState<"default" | "payment" | "return">( "default" );

	const gameId = useStore( store, state => state.id );
	const bank = useStore( store, state => state.tokens );
	const discounts = useStore( store, state => state.players[ state.playerId ].cards );
	const reserved = useStore( store, state => state.players[ state.playerId ].reserved );
	const playerTokens = useStore( store, state => state.players[ state.playerId ].tokens );
	const [ returnedTokens, setReturnedTokens ] = useState<Partial<Tokens>>( {} );
	const [ paymentTokens, setPaymentTokens ] = useState<Partial<Tokens>>( {} );

	const canPurchaseWithoutGold = Object.keys( props.card.cost ).map( g => g as keyof Cost ).every( gem => {
		const discountsForGem = discounts.filter( card => card.bonus === gem ).length;
		return playerTokens[ gem ] + discountsForGem >= props.card.cost[ gem ];
	} );

	const goldNeededIfShort = Object.keys( props.card.cost )
		.map( g => g as keyof Cost )
		.reduce( ( goldNeeded, gem ) => {
			const discountsForGem = discounts.filter( card => card.bonus === gem ).length;
			return goldNeeded + Math.max( 0, props.card.cost[ gem ] - playerTokens[ gem ] - discountsForGem );
		}, 0 );

	const canPurchase = canPurchaseWithoutGold || ( ( playerTokens.gold || 0 ) >= goldNeededIfShort );
	const canReserve = reserved.length < 3;

	const reserveCardMutation = useReserveCardMutation( {} );
	const purchaseCardMutation = usePurchaseCardMutation( {} );

	const handlePurchaseClick = async () => {
		if ( type === "default" ) {
			setType( "payment" );
			return;
		}

		await purchaseCardMutation.mutateAsync( {
			gameId,
			cardId: props.card.id,
			payment: paymentTokens
		} );
	};

	const handleReserveClick = async () => {
		const tokenCount = Object.values( playerTokens ).reduce( ( sum, val ) => sum + ( val || 0 ), 0 );
		const canTakeGold = bank.gold > 0;

		if ( type === "default" ) {
			if ( canTakeGold && tokenCount + 1 > 10 ) {
				setType( "return" );
				return;
			}
		}

		const returnedToken = Object.keys( returnedTokens ).map( g => g as Gem )
			.find( g => ( returnedTokens[ g ] ?? 0 ) > 0 );

		await reserveCardMutation.mutateAsync( {
			gameId,
			cardId: props.card.id,
			withGold: canTakeGold,
			returnedToken
		} );
	};

	return (
		<Dialog>
			<DialogTrigger>
				<GameCard card={ props.card }/>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle className={ "font-bold" }>
						{ type === "default" && "CARD ACTIONS" }
						{ type === "payment" && "PURCHASE CARD" }
						{ type === "return" && "RETURN TOKENS" }
					</DialogTitle>
					<DialogDescription/>
				</DialogHeader>
				<div className={ "flex flex-col gap-2 items-center" }>
					{ type === "default" && <GameCard card={ props.card }/> }
					{ type === "return" && (
						<TokenPicker
							initialTokens={ playerTokens }
							sourceText={ "AVAILABLE" }
							sinkText={ "RETURN" }
							pickLimit={ 1 }
							allowGold
							onPickChange={ setReturnedTokens }
						/>
					) }
					{ type === "payment" && (
						<Fragment>
							<div className={ "grid grid-cols-2" }>
								<GameCard card={ props.card }/>
								<div className={ "grid gap-2 grid-cols-3" }>
									{ Object.keys( playerTokens ).map( g => g as Gem ).map( gem => (
										<div
											className={ cn(
												"w-8 h-12 md:w-10 md:h-15 p-1",
												"flex rounded-md items-center justify-center",
												"border-3 border-gray-400",
												"text-2xl md:text-3xl text-neutral-dark",
												gemLightColors[ gem ]
											) }
											key={ gem }
										>
											<h2>{ discounts.filter( c => c.bonus === gem ).length }</h2>
										</div>
									) ) }
								</div>
							</div>
							<TokenPicker
								initialTokens={ playerTokens }
								sourceText={ "TOKENS" }
								sinkText={ "PAYMENT" }
								allowGold
								onPickChange={ setPaymentTokens }
							/>
						</Fragment>
					) }
				</div>
				<DialogFooter>
					{ ( type === "default" || type === "payment" ) && (
						<Button
							onClick={ handlePurchaseClick }
							disabled={ !canPurchase || purchaseCardMutation.isPending }
						>
							{ purchaseCardMutation.isPending ? <Spinner/> : "PURCHASE" }
						</Button>
					) }
					{ ( type === "default" || type === "return" ) && (
						<Button
							onClick={ handleReserveClick }
							disabled={ !canReserve || reserveCardMutation.isPending }
						>
							{ reserveCardMutation.isPending ? <Spinner/> : "RESERVE" }
						</Button>
					) }
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}