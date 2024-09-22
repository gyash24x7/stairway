import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTrigger } from "@base/ui";
import { useMemo, useState } from "react";
import { useCardCounts, useGameId, useMyTeam, usePlayerId, usePlayers } from "../store.ts";
import { TransferTurn } from "./game-actions.tsx";
import { SelectPlayer } from "./select-player.tsx";

export const TransferTurnDialog = () => {
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
					<TransferTurn gameId={ gameId } transferTo={ selectedPlayer! } onSubmit={ closeDialog }/>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};