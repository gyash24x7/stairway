import { useAtomSet, useAtomValue } from "@effect/atom-react";

import { cn } from "cn";
import { useState } from "react";
import { useBoolean } from "usehooks-ts";

import type { Card, Gem, Tokens } from "@/games/splendor/schema";
import { purchaseCardAtom } from "@/games/splendor/ui/client";
import { GameCard } from "@/games/splendor/ui/game-card";
import { TokenPicker } from "@/games/splendor/ui/token-picker";
import { gemLightColors } from "@/games/splendor/ui/utils";
import { canPurchaseCard, isValidPayment } from "@/games/splendor/utils";
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


type PurchaseCardProps = {
	card: Card;
	tokens: Tokens;
	discounts: readonly Card[];
	gameId: string;
};

export function PurchaseCard( props: PurchaseCardProps ) {
	const purchaseCard = useAtomSet( purchaseCardAtom, { mode: "promiseExit" } );
	const isPending = useAtomValue( purchaseCardAtom ).waiting;
	const { value, setTrue, setFalse, toggle } = useBoolean();
	const [ payment, setPayment ] = useState<Partial<Tokens>>( {} );

	const canPurchase = canPurchaseCard( props.card, props.tokens, props.discounts );
	const isPaymentCorrect = isValidPayment( props.card, payment, props.discounts );

	const closeDrawer = () => {
		setFalse();
		setPayment( {} );
	};

	const handlePurchaseClick = () => void purchaseCard( {
		params: { gameId: GameId.make( props.gameId ) },
		payload: { cardId: props.card.id, payment }
	} ).then( closeDrawer );

	return (
		<Drawer open={ value } onOpenChange={ toggle }>
			<Button onClick={ setTrue } disabled={ !canPurchase } className={ "w-full" }>
				PURCHASE
			</Button>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>PURCHASE CARD</DrawerTitle>
					<DrawerDescription/>
				</DrawerHeader>
				<div className={ "px-4 flex flex-col gap-2 overflow-y-scroll max-h-100" }>
					<div className={ "grid grid-cols-2" }>
						<GameCard card={ props.card } disabled/>
						<div className={ "grid gap-2 grid-cols-3" }>
							{ Object.keys( props.tokens ).map( g => g as Gem ).map( gem => (
								<div
									className={ cn(
										"w-8 h-12 md:w-10 md:h-15 p-1",
										"flex rounded-md items-center justify-center",
										"border-3 border-outline",
										"text-2xl md:text-3xl text-neutral-dark",
										gemLightColors[ gem ]
									) }
									key={ gem }
								>
									{ props.discounts.filter( c => c.bonus === gem ).length }
								</div>
							) ) }
						</div>
					</div>
					<TokenPicker
						initialTokens={ props.tokens }
						sourceText={ "TOKENS" }
						sinkText={ "PAYMENT" }
						allowGold
						onPickChange={ setPayment }
					/>
				</div>
				<DrawerFooter>
					<Button
						onClick={ handlePurchaseClick }
						disabled={ isPending || !isPaymentCorrect }
						className={ "flex-1" }
					>
						{ isPending ? <Spinner/> : "PURCHASE" }
					</Button>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
