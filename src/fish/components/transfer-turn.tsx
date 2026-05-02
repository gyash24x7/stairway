"use client";

import { useFish } from "@/fish/components/context";
import { transferTurn } from "@/fish/core/actions";
import { getTeammates } from "@/fish/core/utils";
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
import { useState, useTransition } from "react";

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

	const [ isPending, startTransition ] = useTransition();

	const handleClick = () => startTransition( async () => {
		if ( selectedPlayer ) {
			await transferTurn( { gameId: shared.id, transferTo: selectedPlayer } );
			closeDrawer();
		}
	} );

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
					<Button onClick={ handleClick } disabled={ isPending } className={ "w-full" }>
						{ isPending ? <Spinner/> : "TRANSFER TURN" }
					</Button>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
