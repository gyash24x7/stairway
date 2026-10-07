import { useAtomSet } from "@effect/atom-react";

import { useState } from "react";

import type { BoardSize } from "@/games/kingdomino/schema";
import {
	KINGDOMINO_BOARD_SIZES,
	KINGDOMINO_DEFAULT_BOARD_SIZE,
	KINGDOMINO_PLAYER_COUNTS
} from "@/games/kingdomino/schema";
import { createGameAtom } from "@/games/kingdomino/ui/client";
import { RadioSelect } from "@/shared/primitives/radio-select";
import type { CreateGameOptions } from "@/swish/ui/create-game";
import { CreateGame } from "@/swish/ui/create-game";

type PlayerCount = typeof KINGDOMINO_PLAYER_COUNTS[ number ];

/**
 * The lobby. Seats and kingdom size are not independent — a 7x7 kingdom needs
 * twenty-four dominoes a seat, which only two seats can be dealt out of a
 * forty-eight domino box — so each control disables what the other rules out,
 * and the payload schema refuses the rest at the decode boundary anyway.
 */
export function KingdominoCreateGame() {
	const createGame = useAtomSet( createGameAtom, { mode: "promise" } );

	const [ playerCount, setPlayerCount ] = useState<PlayerCount>();
	const [ boardSize, setBoardSize ] = useState<BoardSize>( KINGDOMINO_DEFAULT_BOARD_SIZE );

	const handlePlayerCount = ( count: PlayerCount | undefined ) => {
		setPlayerCount( count );
		if ( count !== 2 ) {
			setBoardSize( KINGDOMINO_DEFAULT_BOARD_SIZE );
		}
	};

	const handleCreate = ( { isPrivate }: CreateGameOptions ) => playerCount === 2
		? createGame( { payload: { playerCount: 2, boardSize, isPrivate } } )
		: createGame( {
			payload: {
				playerCount: ( playerCount ?? 4 ) as 3 | 4,
				boardSize: KINGDOMINO_DEFAULT_BOARD_SIZE,
				isPrivate
			}
		} );

	return (
		<CreateGame
			game={ "kingdomino" }
			disabled={ !playerCount }
			createGame={ handleCreate }
		>
			<div className={ "flex flex-col gap-2" }>
				<label className={ "text-sm text-muted-foreground" }>Player Count</label>
				<RadioSelect
					options={ KINGDOMINO_PLAYER_COUNTS }
					value={ playerCount }
					onChange={ handlePlayerCount }
				/>

				<label className={ "text-sm text-muted-foreground" }>Board&nbsp;Size</label>
				<RadioSelect
					options={ KINGDOMINO_BOARD_SIZES }
					value={ boardSize }
					onChange={ v => v !== undefined && setBoardSize( v ) }
					allowDeselect={ false }
					isDisabled={ size => size !== KINGDOMINO_DEFAULT_BOARD_SIZE && playerCount !== 2 }
				/>
				<p className={ "text-xs text-muted-foreground" }>
					A 7x7 kingdom is a duel only — three or four of them would need more
					dominoes than the box holds.
				</p>
			</div>
		</CreateGame>
	);
}
