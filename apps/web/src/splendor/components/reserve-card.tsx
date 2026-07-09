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
import { orpc } from "@s2h/client/query";
import { TokenPicker } from "@/splendor/components/token-picker";
import type { Card, Gem, Tokens } from "@s2h/splendor-core/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { startTransition, useState, useTransition } from "react";
import { useBoolean } from "usehooks-ts";

type ReserveCardProps = {
	gameId: GameId;
	card: Card;
	tokens: Tokens;
	availableSlots: number;
	isGoldAvailable: boolean;
}

export function ReserveCard( props: ReserveCardProps ) {
	const [ isPending ] = useTransition();
	const { value, setTrue, setFalse, toggle } = useBoolean();
	const [ returned, setReturned ] = useState<Partial<Tokens>>( {} );
	const queryClient = useQueryClient();

	const reserveCard = useMutation( orpc.splendor.reserveCard.mutationOptions( {
		onSuccess: () => queryClient.invalidateQueries( {
			queryKey: orpc.splendor.getGame.key( { input: { gameId: props.gameId } } )
		} )
	} ) );

	const isReturnValid = Object.values( returned ).reduce( ( sum, v ) => sum + v, 0 ) === 1;

	const openDrawer = () => {
		setTrue();
	};

	const closeDrawer = () => {
		setFalse();
		setReturned( {} );
	};

	const handleReserveClick = () => {
		if ( value ) {
			// The engine only ever accepts a non-gold gem back (you cannot return the
			// gold you just gained), matching the reserveCard input schema.
			const returnedToken = Object.keys( returned ).map( g => g as Exclude<Gem, "gold"> )
				.find( g => ( returned[ g ] ?? 0 ) > 0 );

			return startTransition( async () => {
				await reserveCard.mutateAsync( {
					gameId: props.gameId,
					cardId: props.card.id,
					returnedToken,
					withGold: props.isGoldAvailable
				} );

				closeDrawer();
			} );
		}

		const tokenCount = Object.values( props.tokens ).reduce( ( sum, val ) => sum + val, 0 );
		if ( props.isGoldAvailable && ( tokenCount + 1 ) > 10 ) {
			openDrawer();
			return;
		}

		return startTransition( async () => {
			await reserveCard.mutateAsync( {
				gameId: props.gameId,
				cardId: props.card.id,
				withGold: props.isGoldAvailable
			} );

			closeDrawer();
		} );
	};

	return (
		<Drawer open={ value } onOpenChange={ toggle }>
			<Button
				onClick={ handleReserveClick }
				disabled={ props.availableSlots <= 0 }
				className={ "w-full" }
			>
				RESERVE
			</Button>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>RETURN TOKEN</DrawerTitle>
					<DrawerDescription>
						Return a token to reserve with gold
					</DrawerDescription>
				</DrawerHeader>
				<div className={ "px-4 flex flex-col gap-2" }>
					<TokenPicker
						initialTokens={ props.tokens }
						sourceText={ "AVAILABLE" }
						sinkText={ "RETURN" }
						pickLimit={ 1 }
						allowGold
						onPickChange={ setReturned }
					/>
				</div>
				<DrawerFooter>
					<Button
						onClick={ handleReserveClick }
						disabled={ isPending || props.availableSlots <= 0 || !isReturnValid }
						className={ "flex-1" }
					>
						{ isPending ? <Spinner/> : "RETURN & RESERVE" }
					</Button>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}