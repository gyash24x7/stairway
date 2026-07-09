import { orpc } from "@/api/query";
import type { GameId } from "@s2h/engine/types";
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
import { cn } from "@s2h/shared/utils/cn";
import { GameCard } from "@/splendor/components/game-card";
import { TokenPicker } from "@/splendor/components/token-picker";
import { gemLightColors } from "@/splendor/components/utils";
import type { Card, Gem, Tokens } from "@s2h/splendor-core/types";
import { canPurchaseCard, isValidPayment } from "@s2h/splendor-core/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { startTransition, useState, useTransition } from "react";
import { useBoolean } from "usehooks-ts";

type PurchaseCardProps = {
	gameId: GameId;
	card: Card;
	tokens: Tokens;
	discounts: Card[];
}

export function PurchaseCard( props: PurchaseCardProps ) {
	const [ isPending ] = useTransition();
	const { value, setTrue, setFalse, toggle } = useBoolean();
	const [ payment, setPayment ] = useState<Partial<Tokens>>( {} );
	const queryClient = useQueryClient();

	const purchaseCard = useMutation( orpc.splendor.purchaseCard.mutationOptions( {
		onSuccess: () => queryClient.invalidateQueries( {
			queryKey: orpc.splendor.getGame.key( { input: { gameId: props.gameId } } )
		} )
	} ) );

	const canPurchase = canPurchaseCard( props.card, props.tokens, props.discounts );
	const isPaymentCorrect = isValidPayment( props.card, payment, props.discounts );

	const openDrawer = () => {
		setTrue();
	};

	const closeDrawer = () => {
		setFalse();
		setPayment( {} );
	};

	const handlePurchaseClick = () => startTransition( async () => {
		await purchaseCard.mutateAsync( {
			gameId: props.gameId,
			cardId: props.card.id,
			payment
		} );

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