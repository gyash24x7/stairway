import { Button } from "@s2h-ui/primitives/button";
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@s2h-ui/primitives/drawer";
import { Spinner } from "@s2h-ui/primitives/spinner";
import { useReserveCardMutation } from "@s2h/client/splendor";
import type { Card } from "@s2h/splendor/types";
import { useStore } from "@tanstack/react-store";
import { useState } from "react";
import { store } from "./store.tsx";

export function ReserveCard() {
	const gameId = useStore( store, state => state.id );
	const [ selectedCard, _setSelectedCard ] = useState<Card>();
	const [ withGold, _setWithGold ] = useState( false );
	const [ showDrawer, setShowDrawer ] = useState( false );

	const { mutateAsync, isPending } = useReserveCardMutation( {
		onSuccess: () => closeDrawer()
	} );

	const openDrawer = () => setShowDrawer( true );
	const closeDrawer = () => setShowDrawer( false );

	const handleClick = () => mutateAsync( { gameId, withGold, cardId: selectedCard!.id } );

	return (
		<Drawer open={ showDrawer } onOpenChange={ setShowDrawer }>
			<Button className={ "flex-1 max-w-lg" } onClick={ openDrawer }>
				RESERVE CARD
			</Button>
			<DrawerContent>
				<div className={ "mx-auto w-full max-w-lg" }>
					<DrawerHeader>
						<DrawerTitle className={ "text-center" }>Reserve Card</DrawerTitle>
					</DrawerHeader>
					<div className={ "px-3 md:px-4" }>

					</div>
					<DrawerFooter>
						<Button onClick={ handleClick } disabled={ isPending } className={ "w-full" }>
							{ isPending ? <Spinner/> : "RESERVE CARD" }
						</Button>
					</DrawerFooter>
				</div>
			</DrawerContent>
		</Drawer>
	);
}