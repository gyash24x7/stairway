"use client";

import { useBoolean } from "usehooks-ts";

import { useSplendor } from "@/games/splendor/client/context.tsx";
import { GameCard } from "@/games/splendor/client/game-card.tsx";
import { PurchaseCard } from "@/games/splendor/client/purchase-card.tsx";
import { ReserveCard } from "@/games/splendor/client/reserve-card.tsx";
import { SPLENDOR_MAX_RESERVED } from "@/games/splendor/shared/schema.ts";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@/shared/ui/primitives/drawer.tsx";

import type { Card } from "@/games/splendor/shared/schema.ts";

export function CardActions( { card }: { card: Card } ) {
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
					<DrawerTitle>CARD ACTIONS</DrawerTitle>
					<DrawerDescription/>
				</DrawerHeader>
				<div className={ "flex justify-center overflow-y-scroll max-h-100" }>
					<GameCard card={ card } disabled/>
				</div>
				<DrawerFooter>
					<div className={ "w-full flex gap-3" }>
						<PurchaseCard card={ card } tokens={ me.tokens } discounts={ me.cards }/>
						<ReserveCard
							card={ card }
							tokens={ me.tokens }
							availableSlots={ SPLENDOR_MAX_RESERVED - me.reserved.length }
							isGoldAvailable={ data.view.tokens.gold > 0 }
						/>
					</div>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
