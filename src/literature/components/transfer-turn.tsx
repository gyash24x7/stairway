"use client";

import { DisplayPlayer } from "@/shared/components/display-player";
import { transferTurn } from "@/literature/server/functions";
import { store } from "@/literature/store";
import { Button } from "@/shared/primitives/button";
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@/shared/primitives/drawer";
import { Spinner } from "@/shared/primitives/spinner";
import { cn } from "@/shared/utils/cn";
import { useStore } from "@tanstack/react-store";
import { useState, useTransition } from "react";

export function TransferTurn() {
	const [ isPending, startTransition ] = useTransition();

	const gameId = useStore( store, state => state.game.id );
	const players = useStore( store, state => state.players );
	const playerId = useStore( store, state => state.playerId );
	const cardCounts = useStore( store, state => state.cardCounts );
	const myTeam = useStore( store, state => {
		const player = state.players[ state.playerId ];
		if ( !player.teamId ) {
			return null;
		}
		return state.teams[ player.teamId ];
	} );

	const [ selectedPlayer, setSelectedPlayer ] = useState<string>();
	const [ showDrawer, setShowDrawer ] = useState( false );

	const myTeamMembersWithCards = myTeam?.memberIds
		.map( memberId => players[ memberId ] )
		.filter( member => !!cardCounts[ member.id ] && member.id !== playerId ) ?? [];

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
							{ myTeamMembersWithCards.map( ( p ) => (
								<div
									key={ p.id }
									onClick={ handlePlayerSelect( selectedPlayer === p.id ? undefined : p.id ) }
									className={ cn(
										selectedPlayer === p.id ? "bg-white" : "bg-bg",
										"cursor-pointer border-2 rounded-md flex justify-center flex-1"
									) }
								>
									<DisplayPlayer player={ p }/>
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