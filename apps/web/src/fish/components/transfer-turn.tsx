"use client";

import { orpc } from "@s2h/client/query";
import { useFish } from "@/fish/components/context";
import { getTeammates } from "@s2h/fish-core/utils";
import { RPlayerInfo } from "@/shared/components/player-info";
import { Button } from "@/shared/primitives/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@/shared/primitives/drawer";
import { RadioSelect } from "@/shared/primitives/radio-select";
import { Spinner } from "@/shared/primitives/spinner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export function TransferTurn() {
	const { shared, player } = useFish();

	const [ selectedPlayer, setSelectedPlayer ] = useState<string>();
	const [ open, setOpen ] = useState( false );

	const teammatesWithCards = getTeammates( shared.state.teams, player.playerId )
		.filter( pid => shared.state.cardCounts[ pid ] > 0 );

	const openDrawer = () => setOpen( true );
	const closeDrawer = () => {
		setOpen( false );
		setSelectedPlayer( undefined );
	};

	const queryClient = useQueryClient();

	const transferTurn = useMutation( orpc.fish.transferTurn.mutationOptions( {
		onSuccess: () => queryClient.invalidateQueries( {
			queryKey: orpc.fish.getGame.key( { input: { gameId: shared.id } } )
		} )
	} ) );

	const handleClick = async () => {
		if ( selectedPlayer ) {
			await transferTurn.mutateAsync( { gameId: shared.id, transferTo: selectedPlayer } );
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
					<Button onClick={ handleClick } disabled={ transferTurn.isPending } className={ "w-full" }>
						{ transferTurn.isPending ? <Spinner/> : "TRANSFER TURN" }
					</Button>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
