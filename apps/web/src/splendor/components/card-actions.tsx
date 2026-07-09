"use client";

import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@s2h/ui/primitives/drawer";
import { useSplendor } from "@/splendor/components/context";
import { GameCard } from "@/splendor/components/game-card";
import { PurchaseCard } from "@/splendor/components/purchase-card";
import { ReserveCard } from "@/splendor/components/reserve-card";
import type { Card } from "@s2h/splendor-core/types";
import { useBoolean } from "usehooks-ts";

type CardActionsMenuProps = {
	card: Card;
}

export function CardActions( props: CardActionsMenuProps ) {
	const { value, toggle, setTrue } = useBoolean();
	const { shared, player } = useSplendor();

	const isMyTurn = shared.status === "IN_PROGRESS"
		&& shared.context.currentPlayer === player.playerId;

	const discounts = shared.state.playerData[ player.playerId ].cards;
	const reserved = shared.state.playerData[ player.playerId ].reserved;
	const playerTokens = shared.state.playerData[ player.playerId ].tokens;


	return (
		<Drawer open={ value } onOpenChange={ toggle }>
			<GameCard card={ props.card } disabled={ !isMyTurn } onCardClick={ setTrue }/>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>CARD ACTIONS</DrawerTitle>
					<DrawerDescription/>
				</DrawerHeader>
				<div className={ "flex justify-center" }>
					<GameCard card={ props.card }/>
				</div>
				<DrawerFooter>
					<div className={ "w-full flex gap-3" }>
						<PurchaseCard
							gameId={ shared.id }
							card={ props.card }
							tokens={ playerTokens }
							discounts={ discounts }
						/>
						<ReserveCard
							gameId={ shared.id }
							card={ props.card }
							tokens={ playerTokens }
							availableSlots={ 3 - reserved.length }
							isGoldAvailable={ shared.state.tokens.gold > 0 }
						/>
					</div>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
