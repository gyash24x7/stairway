"use client";

import { useFish } from "@/fish/components/context";
import { transferTurn } from "@/fish/core/actions";
import { getTeammates } from "@/fish/core/utils";
import { RPlayerInfo } from "@/shared/components/player-info";
import { Button } from "@/shared/primitives/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "@/shared/primitives/dialog";
import { Spinner } from "@/shared/primitives/spinner";
import { cn } from "@/shared/utils/cn";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

export function TransferTurn() {
	const { game } = useFish();

	const [ selectedPlayer, setSelectedPlayer ] = useState<string>();
	const [ showDialog, setShowDialog ] = useState( false );

	const teammatesWithCards = getTeammates( game.state.teams, game.state.playerId )
		.filter( pid => game.state.cardCounts[ pid ] > 0 );

	const openDialog = () => setShowDialog( true );
	const closeDialog = () => setShowDialog( false );

	const handlePlayerSelect = ( playerId?: string ) => () => {
		if ( !playerId ) {
			setSelectedPlayer( undefined );
		} else {
			setSelectedPlayer( playerId );
		}
	};

	const transferTurnFn = useServerFn( transferTurn );
	const { isPending, mutate } = useMutation( {
		mutationFn: transferTurnFn,
		onSuccess: () => closeDialog()
	} );

	const handleClick = () => {
		if ( selectedPlayer ) {
			mutate( { data: { gameId: game.id, transferTo: selectedPlayer } } );
		}
	};

	return (
		<Dialog open={ showDialog } onOpenChange={ setShowDialog }>
			<Button className={ "flex-1 max-w-lg" } onClick={ openDialog }>
				TRANSFER TURN
			</Button>
			<DialogContent className={ "min-w-xl" }>
				<DialogHeader>
					<DialogTitle>Transfer Turn</DialogTitle>
					<DialogDescription/>
				</DialogHeader>
				<div className={ "grid gap-3 grid-cols-3" }>
					{ teammatesWithCards.map( ( pid ) => (
						<div
							key={ pid }
							onClick={ handlePlayerSelect( selectedPlayer === pid ? undefined : pid ) }
							className={ cn(
								"cursor-pointer border-2 rounded-md flex justify-center flex-1 bg-background",
								selectedPlayer === pid && "border-accent bg-accent/20"
							) }
						>
							<RPlayerInfo player={ game.players[ pid ] }/>
						</div>
					) ) }
				</div>
				<DialogFooter>
					<Button onClick={ handleClick } disabled={ isPending } className={ "w-full" }>
						{ isPending ? <Spinner/> : "TRANSFER TURN" }
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}