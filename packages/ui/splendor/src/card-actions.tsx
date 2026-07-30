"use client";

import type { Card } from "@s2h/schema/splendor";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@s2h/ui/primitives/drawer";
import { useBoolean } from "usehooks-ts";
import { useSplendor } from "./context";
import { GameCard } from "./game-card";
import { PurchaseCard } from "./purchase-card";
import { ReserveCard } from "./reserve-card";

type CardActionsMenuProps = {
	card: Card;
}

export function CardActions( props: CardActionsMenuProps ) {
	const { value, toggle, setTrue } = useBoolean();
	const { data } = useSplendor();

	const isMyTurn = data.status === "IN_PROGRESS"
		&& data.context.currentPlayer === data.view.playerId;

	const {
		cards: discounts,
		reserved,
		tokens: playerTokens
	} = data.view.playerData[ data.view.playerId ];

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
							gameId={ data.id }
							card={ props.card }
							tokens={ playerTokens }
							discounts={ discounts }
						/>
						<ReserveCard
							gameId={ data.id }
							card={ props.card }
							tokens={ playerTokens }
							availableSlots={ 3 - reserved.length }
							isGoldAvailable={ data.view.tokens.gold > 0 }
						/>
					</div>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
