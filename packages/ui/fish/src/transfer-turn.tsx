"use client";

import { useAuth } from "@s2h-ui/auth/use-auth";
import { getTeammates } from "@s2h/fish/utils";
import type { PlayerId } from "@s2h/swish/schema";
import { RPlayerInfo } from "@s2h/ui/components/player-info";
import { Button } from "@s2h/ui/primitives/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@s2h/ui/primitives/drawer";
import { RadioSelect } from "@s2h/ui/primitives/radio-select";
import { Spinner } from "@s2h/ui/primitives/spinner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toPlayerInfo, transferTurnFn } from "./client";
import { useFish } from "./context";

export function TransferTurn() {
	const { shared, player } = useFish();
	const { authInfo } = useAuth();

	const [ selectedPlayer, setSelectedPlayer ] = useState<PlayerId>();
	const [ open, setOpen ] = useState( false );

	const teammatesWithCards = getTeammates( shared.state.teams, player.playerId )
		.filter( pid => shared.state.cardCounts[ pid ] > 0 );

	const openDrawer = () => setOpen( true );
	const closeDrawer = () => {
		setOpen( false );
		setSelectedPlayer( undefined );
	};

	const queryClient = useQueryClient();

	const transferTurn = useMutation( {
		mutationFn: ( transferTo: PlayerId ) =>
			transferTurnFn( shared.id, toPlayerInfo( authInfo! ), { transferTo } ),
		onSuccess: () => queryClient.invalidateQueries( {
			queryKey: [ "fish", "getState", shared.id ]
		} )
	} );

	const handleClick = async () => {
		if ( selectedPlayer && authInfo ) {
			await transferTurn.mutateAsync( selectedPlayer );
			closeDrawer();
		}
	};

	return (
		<Drawer open={ open } onOpenChange={ isOpen => !isOpen ? closeDrawer() : setOpen( true ) }>
			<Button className={ "flex-1 max-w-lg" } onClick={ openDrawer }>
				TRANSFER TURN
			</Button>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>Transfer Turn</DrawerTitle>
					<DrawerDescription/>
				</DrawerHeader>
				<div className={ "px-4" }>
					<RadioSelect
						options={ teammatesWithCards }
						value={ selectedPlayer }
						onChange={ setSelectedPlayer }
						className={ "grid gap-3 grid-cols-3" }
						renderOption={ pid => <RPlayerInfo player={ shared.players[ pid ] }/> }
					/>
				</div>
				<DrawerFooter>
					<Button onClick={ handleClick } disabled={ transferTurn.isPending }
					        className={ "w-full" }>
						{ transferTurn.isPending ? <Spinner/> : "TRANSFER TURN" }
					</Button>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
