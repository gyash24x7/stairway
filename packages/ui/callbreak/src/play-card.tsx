import { Button } from "@s2h-ui/primitives/button";
import {
	Drawer,
	DrawerContent,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger
} from "@s2h-ui/primitives/drawer";
import { Spinner } from "@s2h-ui/primitives/spinner";
import { DisplayCard } from "@s2h-ui/shared/display-card";
import { getPlayableCards } from "@s2h/callbreak/utils";
import { usePlayCardMutation } from "@s2h/client/callbreak";
import type { CardId } from "@s2h/utils/cards";
import { getSortedHand } from "@s2h/utils/cards";
import { useStore } from "@tanstack/react-store";
import { useState } from "react";
import { store } from "./store.tsx";

export function PlayCard() {
	const [ selectedCard, setSelectedCard ] = useState<CardId>();
	const [ open, setOpen ] = useState( false );

	const gameId = useStore( store, state => state.id );
	const dealId = useStore( store, state => state.currentDeal!.id );
	const roundId = useStore( store, state => state.currentRound!.id );
	const playableCards = useStore( store, state => getPlayableCards( state.hand, state.trump, state.currentRound! ) );

	const { mutateAsync, isPending } = usePlayCardMutation( {
		onSuccess: () => closeDrawer(),
		onError: ( error ) => alert( error.message )
	} );

	const openDrawer = () => {
		setOpen( true );
	};

	const closeDrawer = () => {
		setSelectedCard( undefined );
		setOpen( false );
	};

	const handleCardSelect = ( cardId?: CardId ) => () => {
		setSelectedCard( cardId );
	};

	const handleClick = () => mutateAsync( { gameId, dealId, roundId, cardId: selectedCard! } );

	return (
		<Drawer open={ open } onOpenChange={ setOpen }>
			<DrawerTrigger asChild>
				<Button onClick={ openDrawer } className={ "w-full max-w-lg" }>PLAY CARD</Button>
			</DrawerTrigger>
			<DrawerContent>
				<div className={ "mx-auto w-full max-w-lg" }>
					<DrawerHeader>
						<DrawerTitle className={ "text-center" }>SELECT CARD TO PLAY</DrawerTitle>
					</DrawerHeader>
					<div className={ "px-3 md:px-4" }>
						<div className={ "flex gap-3 flex-wrap justify-center" }>
							{ getSortedHand( playableCards ).map( ( cardId ) => (
								<div
									key={ cardId }
									onClick={ handleCardSelect( selectedCard === cardId ? undefined : cardId ) }
									className={ "cursor-pointer rounded-md flex justify-center" }
								>
									<DisplayCard cardId={ cardId } focused={ selectedCard === cardId }/>
								</div>
							) ) }
						</div>
					</div>
					<DrawerFooter>
						<Button
							onClick={ handleClick }
							disabled={ isPending || !selectedCard }
							className={ "max-w-lg" }
						>
							{ isPending ? <Spinner/> : "PLAY CARD" }
						</Button>
					</DrawerFooter>
				</div>
			</DrawerContent>
		</Drawer>
	);
}
