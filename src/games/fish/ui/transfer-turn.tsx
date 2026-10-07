import * as Exit from "effect/Exit";

import { useAtomSet, useAtomValue } from "@effect/atom-react";

import { useState } from "react";

import type { FishConfig, FishView } from "@/games/fish/schema";
import { transferTurnAtom } from "@/games/fish/ui/client";
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
import { toast } from "@/shared/primitives/sonner";
import { Spinner } from "@/shared/primitives/spinner";
import { causeMessage } from "@/shared/shell/errors";
import type { GameView, PlayerId } from "@/swish/schema";
import { GameId } from "@/swish/schema";
import { RPlayerInfo } from "@/swish/ui/player-info";
import { teamMatesOf } from "@/swish/utils";


export type TransferTurnProps = {
	readonly game: GameView<FishView, FishConfig>;
	readonly me: PlayerId;
	readonly gameId: string;
};

export function TransferTurn( { game, me, gameId }: TransferTurnProps ) {
	const transferTurn = useAtomSet( transferTurnAtom, { mode: "promiseExit" } );
	const isPending = useAtomValue( transferTurnAtom ).waiting;

	const [ selectedPlayer, setSelectedPlayer ] = useState<PlayerId>();
	const [ open, setOpen ] = useState( false );

	const teammatesWithCards = teamMatesOf( game.context, me )
		.filter( playerId => ( game.view.cardCounts[ playerId ] ?? 0 ) > 0 );

	const closeDrawer = () => {
		setOpen( false );
		setSelectedPlayer( undefined );
	};

	const handleClick = async () => {
		if ( !selectedPlayer ) {
			return;
		}

		const exit = await transferTurn( {
			params: { gameId: GameId.make( gameId ) },
			payload: { transferTo: selectedPlayer }
		} );

		if ( Exit.isFailure( exit ) ) {
			toast.error( causeMessage( exit.cause ) );
			return;
		}

		closeDrawer();
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
						renderOption={ pid => {
							const player = game.players[ pid ];
							return player ? <RPlayerInfo player={ player }/> : null;
						} }
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
