import { Button, Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from "@base/components";
import { useCardCounts, useGameId, useMyTeam, usePlayerId, usePlayers } from "@literature/store";
import { useState } from "react";
import { TransferTurn } from "./game-actions";
import { SelectPlayer } from "./select-player";

export function TransferTurnDialog() {
	const gameId = useGameId();
	const myTeam = useMyTeam();
	const players = usePlayers();
	const playerId = usePlayerId();
	const cardCounts = useCardCounts();

	const [ selectedPlayer, setSelectedPlayer ] = useState<string>();
	const [ showDrawer, setShowDrawer ] = useState( false );

	const myTeamMembersWithCards = myTeam?.memberIds
		.map( memberId => players[ memberId ] )
		.filter( member => !!cardCounts[ member.id ] && member.id !== playerId ) ?? [];

	const openDrawer = () => setShowDrawer( true );
	const closeDrawer = () => setShowDrawer( false );

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
					<div className={ "px-4" }>
						<SelectPlayer
							options={ myTeamMembersWithCards }
							setPlayer={ setSelectedPlayer }
							player={ selectedPlayer }
						/>
					</div>
					<DrawerFooter>
						<TransferTurn gameId={ gameId } transferTo={ selectedPlayer! } onSubmit={ closeDrawer }/>
					</DrawerFooter>
				</div>
			</DrawerContent>
		</Drawer>
	);
}