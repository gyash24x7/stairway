import { useBoolean } from "usehooks-ts";

import type { Card, PlayerData } from "@/games/splendor/schema";
import { SPLENDOR_MAX_RESERVED } from "@/games/splendor/schema";
import { GameCard } from "@/games/splendor/ui/game-card";
import { PurchaseCard } from "@/games/splendor/ui/purchase-card";
import { ReserveCard } from "@/games/splendor/ui/reserve-card";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@/shared/primitives/drawer";


export type CardActionsProps = {
	card: Card;
	gameId: string;
	isMyTurn: boolean;
	me?: PlayerData;
	bankGold: number;
};

export function CardActions( { card, gameId, isMyTurn, me, bankGold }: CardActionsProps ) {
	const { value, toggle, setTrue } = useBoolean();

	if ( !me ) {
		return <GameCard card={ card } disabled/>;
	}

	return (
		<Drawer open={ value } onOpenChange={ toggle }>
			<GameCard card={ card } disabled={ !isMyTurn } onCardClick={ setTrue }/>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>CARD ACTIONS</DrawerTitle>
					<DrawerDescription/>
				</DrawerHeader>
				<div className={ "flex justify-center overflow-y-scroll max-h-100" }>
					<GameCard card={ card } disabled/>
				</div>
				<DrawerFooter>
					<div className={ "w-full flex gap-3" }>
						<PurchaseCard card={ card } tokens={ me.tokens } discounts={ me.cards }
													gameId={ gameId }/>
						<ReserveCard
							card={ card }
							tokens={ me.tokens }
							availableSlots={ SPLENDOR_MAX_RESERVED - me.reserved.length }
							isGoldAvailable={ bankGold > 0 }
							gameId={ gameId }
						/>
					</div>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
