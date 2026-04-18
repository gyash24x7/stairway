"use client";

import { Button } from "@/shared/primitives/button";
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
import { cn } from "@/shared/utils/cn";
import { useSplendor } from "@/splendor/components/context";
import { GameCard } from "@/splendor/components/game-card";
import { TokenPicker } from "@/splendor/components/token-picker";
import { gemLightColors } from "@/splendor/components/utils";
import { purchaseCard, reserveCard } from "@/splendor/core/actions";
import type { Card, Cost, Gem, Tokens } from "@/splendor/core/types";
import { Fragment, useState, useTransition } from "react";

type CardActionsMenuProps = {
	card: Card;
}

export function CardActions( props: CardActionsMenuProps ) {
	const [ open, setOpen ] = useState( false );
	const [ type, setType ] = useState<"default" | "payment" | "return">( "default" );
	const [ returnedTokens, setReturnedTokens ] = useState<Partial<Tokens>>( {} );
	const [ paymentTokens, setPaymentTokens ] = useState<Partial<Tokens>>( {} );
	const [ isPending, startTransition ] = useTransition();

	const { game, isMyTurn } = useSplendor();

	const handleOpenChange = ( isOpen: boolean ) => {
		setOpen( isOpen );
		if ( !isOpen ) {
			setType( "default" );
			setReturnedTokens( {} );
			setPaymentTokens( {} );
		}
	};
	const discounts = game.state.playerData[ game.state.playerId ].cards;
	const reserved = game.state.playerData[ game.state.playerId ].reserved;
	const playerTokens = game.state.playerData[ game.state.playerId ].tokens;

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

	const handlePurchaseClick = () => startTransition( async () => {
		if ( type === "default" ) {
			setType( "payment" );
			return;
		}

		await purchaseCard( {
			gameId: game.id,
			cardId: props.card.id,
			payment: paymentTokens
		} );
	} );

	const handleReserveClick = () => startTransition( async () => {
		const tokenCount = Object.values( playerTokens ).reduce( ( sum, val ) => sum + ( val || 0 ), 0 );
		const canTakeGold = game.state.tokens.gold > 0;

		if ( type === "default" ) {
			if ( canTakeGold && tokenCount + 1 > 10 ) {
				setType( "return" );
				return;
			}
		}

		const returnedToken = Object.keys( returnedTokens ).map( g => g as Exclude<Gem, "gold"> )
			.find( g => ( returnedTokens[ g ] ?? 0 ) > 0 );

		await reserveCard( {
			gameId: game.id,
			cardId: props.card.id,
			withGold: canTakeGold,
			returnedToken
		} );
	} );

	return (
		<Dialog open={ open } onOpenChange={ handleOpenChange }>
			<DialogTrigger>
				<GameCard card={ props.card } disabled={ !isMyTurn }/>
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
							disabled={ !canPurchase || isPending }
						>
							{ isPending ? <Spinner/> : "PURCHASE" }
						</Button>
					) }
					{ ( type === "default" || type === "return" ) && (
						<Button
							onClick={ handleReserveClick }
							disabled={ !canReserve || isPending }
						>
							{ isPending ? <Spinner/> : "RESERVE" }
						</Button>
					) }
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
