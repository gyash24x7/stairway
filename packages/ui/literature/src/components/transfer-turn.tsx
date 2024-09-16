"use client";

import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTrigger, Spinner } from "@base/ui";
import { useMemo, useState } from "react";
import { useServerAction } from "zsa-react";
import { transferTurnAction } from "../actions";
import { useCardCounts, useGameId, useMyTeam, usePlayerId, usePlayers } from "../store";
import { SelectPlayer } from "./select-player";

export const TransferTurn = () => {
	const gameId = useGameId();
	const myTeam = useMyTeam();
	const players = usePlayers();
	const playerId = usePlayerId();
	const cardCounts = useCardCounts();

	const [ selectedPlayer, setSelectedPlayer ] = useState<string>();
	const [ showDialog, setShowDialog ] = useState( false );

	const myTeamMembersWithCards = useMemo( () => {
		return myTeam?.memberIds.map( memberId => players[ memberId ] )
			.filter( member => !!cardCounts[ member.id ] && member.id !== playerId ) ?? [];
	}, [ myTeam, cardCounts, players ] );

	const openDialog = () => setShowDialog( true );
	const closeDialog = () => setShowDialog( false );

	const { isPending, execute } = useServerAction( transferTurnAction, {
		onFinish: () => closeDialog()
	} );

	return (
		<Dialog open={ showDialog } onOpenChange={ setShowDialog }>
			<DialogTrigger>
				<Button className={ "w-full" } onClick={ openDialog }>
					TRANSFER TURN
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<h1>Transfer Turn</h1>
				</DialogHeader>
				<div>
					<SelectPlayer
						options={ myTeamMembersWithCards }
						setPlayer={ setSelectedPlayer }
						player={ selectedPlayer }
					/>
				</div>
				<DialogFooter>
					<Button className={ "w-full" } onClick={ () => execute( { gameId, transferTo: selectedPlayer! } ) }>
						{ isPending ? <Spinner/> : "TRANSFER TURN" }
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};