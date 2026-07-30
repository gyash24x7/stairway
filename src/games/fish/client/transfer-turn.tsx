"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useAuth } from "@/auth/client/use-auth.tsx";
import { getTeammates } from "@/games/fish/shared/utils.ts";
import type { PlayerId } from "@/shared/swish/schema.ts";
import { RPlayerInfo } from "@/shared/ui/components/player-info.tsx";
import { Button } from "@/shared/ui/primitives/button.tsx";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@/shared/ui/primitives/drawer.tsx";
import { RadioSelect } from "@/shared/ui/primitives/radio-select.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { transferTurnFn } from "@/games/fish/client/client.ts";
import { useFish } from "@/games/fish/client/context.tsx";

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
