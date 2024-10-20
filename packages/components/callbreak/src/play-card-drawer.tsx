"use client";

import { getSortedHand } from "@stairway/cards";
import {
	Button,
	Drawer,
	DrawerContent,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger
} from "@stairway/components/base";
import { SelectCard } from "@stairway/components/main";
import {
	useCurrentDealId,
	useCurrentRoundId,
	useGameId,
	usePlayableCardsForCurrentRound
} from "@stairway/stores/callbreak";
import { useCallback, useState } from "react";
import { PlayCard } from "./game-actions.tsx";

export function PlayCardDrawer() {
	const gameId = useGameId();
	const dealId = useCurrentDealId();
	const roundId = useCurrentRoundId();
	const playableCards = usePlayableCardsForCurrentRound();

	const [ selectedCard, setSelectedCard ] = useState<string>();
	const [ open, setOpen ] = useState( false );

	const openDrawer = useCallback( () => {
		setOpen( true );
	}, [] );

	const closeDrawer = useCallback( () => {
		setSelectedCard( undefined );
		setOpen( false );
	}, [] );

	return (
		<Drawer open={ open } onOpenChange={ setOpen }>
			<DrawerTrigger asChild>
				<Button onClick={ openDrawer } className={ "flex-1 max-w-lg" }>PLAY CARD</Button>
			</DrawerTrigger>
			<DrawerContent>
				<div className={ "mx-auto w-full max-w-lg" }>
					<DrawerHeader>
						<DrawerTitle className={ "text-center" }>Select Card to Play</DrawerTitle>
					</DrawerHeader>
					<div className={ "px-4" }>
						<SelectCard
							cards={ getSortedHand( playableCards ) }
							selectedCards={ !selectedCard ? [] : [ selectedCard ] }
							onSelect={ ( cardId ) => setSelectedCard( cardId ) }
							onDeselect={ () => setSelectedCard( undefined ) }
						/>
					</div>
					<DrawerFooter>
						<PlayCard
							gameId={ gameId }
							dealId={ dealId! }
							roundId={ roundId! }
							cardId={ selectedCard! }
							onSubmit={ closeDrawer }
						/>
					</DrawerFooter>
				</div>
			</DrawerContent>
		</Drawer>
	);
}
