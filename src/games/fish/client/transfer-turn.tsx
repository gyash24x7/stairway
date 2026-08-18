"use client";

import { useState } from "react";

import { useFish } from "@/games/fish/client/context.tsx";
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
import { RPlayerInfo } from "@/swish/client/player-info.tsx";
import { teamMatesOf } from "@/swish/shared/teams.ts";

import type { PlayerId } from "@/swish/shared/schema.ts";

export function TransferTurn() {
	const { data, transferTurn, isPending } = useFish();

	const [ selectedPlayer, setSelectedPlayer ] = useState<PlayerId>();
	const [ open, setOpen ] = useState( false );

	const teammatesWithCards = teamMatesOf( data.context, data.view.playerId )
		.filter( playerId => ( data.view.cardCounts[ playerId ] ?? 0 ) > 0 );

	const closeDrawer = () => {
		setOpen( false );
		setSelectedPlayer( undefined );
	};

	const handleClick = () => {
		if ( selectedPlayer ) {
			transferTurn( { transferTo: selectedPlayer }, closeDrawer );
		}
	};

	return (
		<Drawer open={ open } onOpenChange={ isOpen => !isOpen ? closeDrawer() : setOpen( true ) }>
			<Button onClick={ () => setOpen( true ) }>TRANSFER TURN</Button>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>TRANSFER TURN</DrawerTitle>
					<DrawerDescription/>
				</DrawerHeader>
				<div className={ "px-4 overflow-y-scroll max-h-100" }>
					<RadioSelect
						options={ teammatesWithCards }
						value={ selectedPlayer }
						onChange={ setSelectedPlayer }
						className={ "grid gap-3 grid-cols-3" }
						renderOption={ pid => <RPlayerInfo player={ data.players[ pid ] }/> }
					/>
				</div>
				<DrawerFooter>
					<Button onClick={ handleClick } disabled={ isPending || !selectedPlayer }
									className={ "w-full" }>
						{ isPending ? <Spinner/> : "TRANSFER TURN" }
					</Button>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
