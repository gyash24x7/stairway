"use client";

import { useState } from "react";

import { kingdominoApi } from "@/games/kingdomino/client/client.ts";
import {
	KINGDOMINO_BOARD_SIZES,
	KINGDOMINO_DEFAULT_BOARD_SIZE,
	KINGDOMINO_PLAYER_COUNTS
} from "@/games/kingdomino/shared/schema.ts";
import { RadioSelect } from "@/shared/ui/primitives/radio-select.tsx";
import { CreateGame } from "@/swish/client/create-game.tsx";

import type { BoardSize } from "@/games/kingdomino/shared/schema.ts";

type PlayerCount = typeof KINGDOMINO_PLAYER_COUNTS[number];

/**
 * The lobby. Seats and kingdom size are not independent — a 7x7 kingdom needs
 * twenty-four dominoes a seat, which only two seats can be dealt out of a
 * forty-eight domino box — so each control disables what the other rules out,
 * and the payload schema refuses the rest at the decode boundary anyway.
 */
export function KingdominoCreateGame() {
	const [ playerCount, setPlayerCount ] = useState<PlayerCount>();
	const [ boardSize, setBoardSize ] = useState<BoardSize>( KINGDOMINO_DEFAULT_BOARD_SIZE );

	const createKingdominoGame = () => kingdominoApi.createGame(
		playerCount === 2
			? { playerCount: 2, boardSize }
			: { playerCount: playerCount as 3 | 4, boardSize: KINGDOMINO_DEFAULT_BOARD_SIZE }
	);

	const handlePlayerCount = ( count: PlayerCount | undefined ) => {
		setPlayerCount( count );
		if ( count !== 2 ) {
			setBoardSize( KINGDOMINO_DEFAULT_BOARD_SIZE );
		}
	};

	return (
		<CreateGame
			game={ "kingdomino" }
			disabled={ !playerCount }
			createGame={ createKingdominoGame }
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
