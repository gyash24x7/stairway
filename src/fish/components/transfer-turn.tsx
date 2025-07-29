"use client";

import { transferTurn } from "@/fish/server/functions";
import { store } from "@/fish/store";
import { DisplayPlayer } from "@/shared/components/display-player";
import { Button } from "@/shared/primitives/button";
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@/shared/primitives/drawer";
import { Spinner } from "@/shared/primitives/spinner";
import { cn } from "@/shared/utils/cn";
import { useStore } from "@tanstack/react-store";
import { useState, useTransition } from "react";

export function TransferTurn() {
	const [ isPending, startTransition ] = useTransition();

	const gameId = useStore( store, state => state.id );
	const cardCounts = useStore( store, state => state.cardCounts );
	const players = useStore( store, state => state.players );
	const playerId = useStore( store, state => state.playerId );
	const teammatesWithCards = players[ playerId ].teamMates.filter( pid => cardCounts[ pid ] > 0 );
	const [ selectedPlayer, setSelectedPlayer ] = useState<string>();
	const [ showDrawer, setShowDrawer ] = useState( false );

	const openDrawer = () => setShowDrawer( true );
	const closeDrawer = () => setShowDrawer( false );

	const handlePlayerSelect = ( playerId?: string ) => () => {
		if ( !playerId ) {
			setSelectedPlayer( undefined );
		} else {
			setSelectedPlayer( playerId );
		}
	};

	const handleClick = () => startTransition( async () => {
		await transferTurn( { gameId, transferTo: selectedPlayer! } );
		closeDrawer();
	} );

	return (
		<Drawer open={ showDrawer } onOpenChange={ setShowDrawer }>
			<Button className={ "flex-1 max-w-lg" } onClick={ openDrawer }>
				TRANSFER TURN
			</Button>
			<DrawerContent>
				<div className={ "mx-auto w-full max-w-lg" }>
					<DrawerHeader>
						<DrawerTitle className={ "text-center" }>Transfer Turn</DrawerTitle>
					</DrawerHeader>
					<div className={ "px-3 md:px-4" }>
						<div className={ "grid gap-3 grid-cols-3 md:grid-cols-4" }>
							{ teammatesWithCards.map( ( pid ) => (
								<div
									key={ pid }
									onClick={ handlePlayerSelect( selectedPlayer === pid ? undefined : pid ) }
									className={ cn(
										selectedPlayer === pid ? "bg-white" : "bg-bg",
										"cursor-pointer border-2 rounded-md flex justify-center flex-1"
									) }
								>
									<DisplayPlayer player={ players[ pid ] }/>
								</div>
							) ) }
						</div>
					</div>
					<DrawerFooter>
						<Button onClick={ handleClick } disabled={ isPending } className={ "w-full" }>
							{ isPending ? <Spinner/> : "TRANSFER TURN" }
						</Button>
					</DrawerFooter>
				</div>
			</DrawerContent>
		</Drawer>
	);
}