import { Button } from "@s2h-ui/primitives/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@s2h-ui/primitives/drawer";
import { Spinner } from "@s2h-ui/primitives/spinner";
import { usePurchaseCardMutation } from "@s2h/client/splendor";
import type { Card, Tokens } from "@s2h/splendor/types";
import { DEFAULT_TOKENS } from "@s2h/splendor/utils";
import { useStore } from "@tanstack/react-store";
import { useState } from "react";
import { store } from "./store.tsx";

export function PurchaseCard() {
	const gameId = useStore( store, state => state.id );

	const [ selectedCard, setSelectedCard ] = useState<Card>();
	const [ tokens, setTokens ] = useState<Tokens>( DEFAULT_TOKENS );
	const [ showDrawer, setShowDrawer ] = useState( false );

	const { mutateAsync, isPending } = usePurchaseCardMutation( {
		onSettled: () => closeDrawer()
	} );

	const openDrawer = () => {
		setShowDrawer( true );
	};

	const closeDrawer = () => {
		setSelectedCard( undefined );
		setTokens( DEFAULT_TOKENS );
		setShowDrawer( false );
	};


	const handleClick = () => mutateAsync( { gameId, cardId: selectedCard!.id, payment: tokens } );

	return (
		<Drawer open={ showDrawer } onOpenChange={ setShowDrawer }>
			<Button onClick={ openDrawer } className={ "flex-1 max-w-lg" }>PURCHASE CARD</Button>
			<DrawerContent>
				<div className={ "mx-auto w-full max-w-lg overscroll-y-auto" }>
					<DrawerHeader>
						<DrawerTitle className={ "text-center" }>PURCHASE CARD</DrawerTitle>
						<DrawerDescription/>
					</DrawerHeader>
					<div className={ "px-4" }>

					</div>
					<DrawerFooter>
						<Button onClick={ handleClick } disabled={ isPending } className={ "flex-1" }>
							{ isPending ? <Spinner/> : "PURCHASE CARD" }
						</Button>
					</DrawerFooter>
				</div>
			</DrawerContent>
		</Drawer>
	);
}
