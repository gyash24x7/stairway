import { useAtomSet, useAtomValue } from "@effect/atom-react";

import { useState } from "react";
import { useBoolean } from "usehooks-ts";

import type { Card, Gem, Tokens } from "@/games/splendor/schema";
import { SPLENDOR_MAX_TOKENS } from "@/games/splendor/schema";
import { reserveCardAtom } from "@/games/splendor/ui/client";
import { TokenPicker } from "@/games/splendor/ui/token-picker";
import { sumTokens } from "@/games/splendor/utils";
import { Button } from "@/shared/primitives/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@/shared/primitives/drawer";
import { Spinner } from "@/shared/primitives/spinner";
import { GameId } from "@/swish/schema";


type ReserveCardProps = {
	card: Card;
	tokens: Tokens;
	availableSlots: number;
	isGoldAvailable: boolean;
	gameId: string;
};

export function ReserveCard( props: ReserveCardProps ) {
	const reserveCard = useAtomSet( reserveCardAtom, { mode: "promiseExit" } );
	const isPending = useAtomValue( reserveCardAtom ).waiting;
	const { value, setTrue, setFalse, toggle } = useBoolean();
	const [ returned, setReturned ] = useState<Partial<Tokens>>( {} );

	const isReturnValid = sumTokens( returned ) === 1;
	const params = { gameId: GameId.make( props.gameId ) };

	const closeDrawer = () => {
		setFalse();
		setReturned( {} );
	};

	const handleReserveClick = () => {
		if ( value ) {
			// The engine only ever accepts a non-gold gem back — you cannot return the
			// gold the reservation just handed you.
			const returnedToken = Object.keys( returned ).map( g => g as Gem )
				.find( g => g !== "gold" && ( returned[ g ] ?? 0 ) > 0 );

			void reserveCard( {
				params,
				payload: {
					cardId: props.card.id,
					returnedToken,
					withGold: props.isGoldAvailable
				}
			} ).then( closeDrawer );
			return;
		}

		// Taking the gold that comes with a reservation can carry the seat over the
		// limit, and the return has to ride the same move — so ask first.
		if ( props.isGoldAvailable && sumTokens( props.tokens ) + 1 > SPLENDOR_MAX_TOKENS ) {
			setTrue();
			return;
		}

		void reserveCard( {
			params,
			payload: { cardId: props.card.id, withGold: props.isGoldAvailable }
		} ).then( closeDrawer );
	};

	return (
		<Drawer open={ value } onOpenChange={ toggle }>
			<Button
				onClick={ handleReserveClick }
				disabled={ props.availableSlots <= 0 || isPending }
				className={ "w-full" }
			>
				RESERVE
			</Button>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>RETURN TOKEN</DrawerTitle>
					<DrawerDescription>Return a token to reserve with gold</DrawerDescription>
				</DrawerHeader>
				<div className={ "px-4 flex flex-col gap-2 overflow-y-scroll max-h-100" }>
					<TokenPicker
						initialTokens={ props.tokens }
						sourceText={ "AVAILABLE" }
						sinkText={ "RETURN" }
						pickLimit={ 1 }
						onPickChange={ setReturned }
					/>
				</div>
				<DrawerFooter>
					<Button
						onClick={ handleReserveClick }
						disabled={ isPending || props.availableSlots <= 0 || !isReturnValid }
						className={ "flex-1" }
					>
						{ isPending ? <Spinner/> : "RETURN & RESERVE" }
					</Button>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
