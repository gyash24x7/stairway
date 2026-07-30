import { useMutation, useQueryClient } from "@tanstack/react-query";
import { startTransition, useState, useTransition } from "react";
import { useBoolean } from "usehooks-ts";

import type { Card, Gem, PurchaseCardInput, Tokens } from "@/games/splendor/shared/schema.ts";
import { canPurchaseCard, isValidPayment } from "@/games/splendor/shared/utils.ts";
import { Button } from "@/shared/ui/primitives/button.tsx";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@/shared/ui/primitives/drawer.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";
import { purchaseCardFn } from "@/games/splendor/client/client.ts";
import { GameCard } from "@/games/splendor/client/game-card.tsx";
import { TokenPicker } from "@/games/splendor/client/token-picker.tsx";
import { gemLightColors } from "@/games/splendor/client/utils.tsx";

type PurchaseCardProps = {
	gameId: string;
	card: Card;
	tokens: Tokens;
	discounts: readonly Card[];
}

export function PurchaseCard( props: PurchaseCardProps ) {
	const [ isPending ] = useTransition();
	const { value, setTrue, setFalse, toggle } = useBoolean();
	const [ payment, setPayment ] = useState<Partial<Tokens>>( {} );
	const queryClient = useQueryClient();

	const purchaseCard = useMutation( {
		mutationFn: ( input: PurchaseCardInput ) => purchaseCardFn( props.gameId, input ),
		onSuccess: () => queryClient.invalidateQueries( {
			queryKey: [ "splendor", "getState", props.gameId ]
		} )
	} );

	const discounts = props.discounts as Card[];
	const canPurchase = canPurchaseCard( props.card, props.tokens, discounts );
	const isPaymentCorrect = isValidPayment( props.card, payment, discounts );

	const openDrawer = () => {
		setTrue();
	};

	const closeDrawer = () => {
		setFalse();
		setPayment( {} );
	};

	const handlePurchaseClick = () => startTransition( async () => {
		await purchaseCard.mutateAsync( { cardId: props.card.id, payment } );
		closeDrawer();
	} );

	return (
		<Drawer open={ value } onOpenChange={ toggle }>
			<Button onClick={ openDrawer } disabled={ !canPurchase } className={ "w-full" }>
				PURCHASE
			</Button>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>PURCHASE CARD</DrawerTitle>
					<DrawerDescription/>
				</DrawerHeader>
				<div className={ "px-4 flex flex-col gap-2" }>
					<div className={ "grid grid-cols-2" }>
						<GameCard card={ props.card }/>
						<div className={ "grid gap-2 grid-cols-3" }>
							{ Object.keys( props.tokens ).map( g => g as Gem ).map( gem => (
								<div
									className={ cn(
										"w-8 h-12 md:w-10 md:h-15 p-1",
										"flex rounded-md items-center justify-center",
										"border-3 border-inverted-surface",
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