"use client";

import { useBoolean } from "usehooks-ts";

import type { Card } from "@/games/splendor/shared/schema.ts";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@/shared/ui/primitives/drawer.tsx";
import { useSplendor } from "@/games/splendor/client/context.tsx";
import { GameCard } from "@/games/splendor/client/game-card.tsx";
import { PurchaseCard } from "@/games/splendor/client/purchase-card.tsx";

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
	const { data } = useSplendor();

	const isMyTurn = data.status === "IN_PROGRESS"
		&& data.context.currentPlayer === data.view.playerId;

	const {
		cards: discounts,
		tokens: playerTokens
	} = data.view.playerData[ data.view.playerId ];

	return (
		<Drawer open={ value } onOpenChange={ toggle }>
			<GameCard card={ card } disabled={ !isMyTurn } onCardClick={ setTrue }/>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>BUY RESERVED CARD</DrawerTitle>
					<DrawerDescription/>
				</DrawerHeader>
				<div className={ "flex justify-center" }>
					<GameCard card={ card } disabled/>
				</div>
				<DrawerFooter>
					<PurchaseCard
						gameId={ data.id }
						card={ card }
						tokens={ playerTokens }
						discounts={ discounts }
					/>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
