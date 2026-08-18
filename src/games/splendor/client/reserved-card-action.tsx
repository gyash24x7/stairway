"use client";

import { useBoolean } from "usehooks-ts";

import { useSplendor } from "@/games/splendor/client/context.tsx";
import { GameCard } from "@/games/splendor/client/game-card.tsx";
import { PurchaseCard } from "@/games/splendor/client/purchase-card.tsx";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@/shared/ui/primitives/drawer.tsx";

import type { Card } from "@/games/splendor/shared/schema.ts";

/**
 * One of your reserved cards on the controller: tap it to buy it.
 *
 * The mirror of `CardActions` for a card already in hand — purchase only, since a
 * reserved card cannot be reserved again. Reserved cards are deliberately *not*
 * in the buy sheet: that sheet is the board, and your own cards belong with the
 * rest of your private state.
 */
export function ReservedCardAction( { card }: { card: Card } ) {
	const { value, toggle, setTrue } = useBoolean();
	const { data, playerId, isMyTurn } = useSplendor();

	const me = playerId ? data.view.playerData[ playerId ] : undefined;
	if ( !me ) {
		return <GameCard card={ card } disabled/>;
	}

	return (
		<Drawer open={ value } onOpenChange={ toggle }>
			<GameCard card={ card } disabled={ !isMyTurn } onCardClick={ setTrue }/>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>BUY RESERVED CARD</DrawerTitle>
					<DrawerDescription/>
				</DrawerHeader>
				<div className={ "flex justify-center overflow-y-scroll max-h-100" }>
					<GameCard card={ card } disabled/>
				</div>
				<DrawerFooter>
					<PurchaseCard card={ card } tokens={ me.tokens } discounts={ me.cards }/>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
