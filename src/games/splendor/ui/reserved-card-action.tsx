import { useBoolean } from "usehooks-ts";

import type { Card, Tokens } from "@/games/splendor/schema";
import { GameCard } from "@/games/splendor/ui/game-card";
import { PurchaseCard } from "@/games/splendor/ui/purchase-card";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@/shared/primitives/drawer";


export type ReservedCardActionProps = {
	card: Card;
	gameId: string;
	isMyTurn: boolean;
	tokens: Tokens;
	discounts: readonly Card[];
};

/**
 * One of your reserved cards on the controller: tap it to buy it.
 *
 * The mirror of `CardActions` for a card already in hand — purchase only, since a
 * reserved card cannot be reserved again. Reserved cards are deliberately *not*
 * in the buy sheet: that sheet is the board, and your own cards belong with the
 * rest of your private state.
 */
export function ReservedCardAction( {
	card,
	gameId,
	isMyTurn,
	tokens,
	discounts
}: ReservedCardActionProps ) {
	const { value, toggle, setTrue } = useBoolean();

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
					<PurchaseCard card={ card } tokens={ tokens } discounts={ discounts } gameId={ gameId }/>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
