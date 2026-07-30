"use client";

import { useAuth } from "@/auth/client/use-auth";
import { getTeammates } from "@/games/fish/shared/utils";
import type { PlayerId } from "@/shared/swish/schema";
import { RPlayerInfo } from "@/shared/ui/components/player-info";
import { Button } from "@/shared/ui/primitives/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@/shared/ui/primitives/drawer";
import { RadioSelect } from "@/shared/ui/primitives/radio-select";
import { Spinner } from "@/shared/ui/primitives/spinner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { transferTurnFn } from "./client";
import { useFish } from "./context";

export function TransferTurn() {
	const { data } = useFish();
	const { authInfo } = useAuth();
	const player = data.view;

	const [ selectedPlayer, setSelectedPlayer ] = useState<PlayerId>();
	const [ open, setOpen ] = useState( false );

	const teammatesWithCards = getTeammates( data.view.teams, player.playerId )
		.filter( pid => data.view.cardCounts[ pid ] > 0 );

	const openDrawer = () => setOpen( true );
	const closeDrawer = () => {
		setOpen( false );
		setSelectedPlayer( undefined );
	};

	const queryClient = useQueryClient();

	const transferTurn = useMutation( {
		mutationFn: ( transferTo: PlayerId ) => transferTurnFn( data.id, { transferTo } ),
		onSuccess: () => queryClient.invalidateQueries( {
			queryKey: [ "fish", "getState", data.id ]
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
						renderOption={ pid => <RPlayerInfo player={ data.players[ pid ] }/> }
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
