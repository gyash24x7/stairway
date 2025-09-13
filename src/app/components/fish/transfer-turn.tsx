"use client";

import { orpc } from "@/app/client/orpc";
import { store } from "@/app/components/fish/store";
import { DisplayPlayer } from "@/app/components/shared/display-player";
import { Button } from "@/app/primitives/button";
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@/app/primitives/drawer";
import { Spinner } from "@/app/primitives/spinner";
import { cn } from "@/utils/cn";
import { useMutation } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { useState } from "react";

export function TransferTurn() {
	const gameId = useStore( store, state => state.id );
	const cardCounts = useStore( store, state => state.cardCounts );
	const players = useStore( store, state => state.players );
	const playerId = useStore( store, state => state.playerId );
	const teammatesWithCards = players[ playerId ].teamMates.filter( pid => cardCounts[ pid ] > 0 );
	const [ selectedPlayer, setSelectedPlayer ] = useState<string>();
	const [ showDrawer, setShowDrawer ] = useState( false );

	const { mutateAsync, isPending } = useMutation( orpc.fish.transferTurn.mutationOptions( {
		onSuccess: () => closeDrawer()
	} ) );

	const openDrawer = () => setShowDrawer( true );
	const closeDrawer = () => setShowDrawer( false );

	const handlePlayerSelect = ( playerId?: string ) => () => {
		if ( !playerId ) {
			setSelectedPlayer( undefined );
		} else {
			setSelectedPlayer( playerId );
		}
	};

	const handleClick = () => mutateAsync( { gameId, transferTo: selectedPlayer! } );

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