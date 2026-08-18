"use client";

import { useState } from "react";

import { splendorApi } from "@/games/splendor/client/client.ts";
import {
	SPLENDOR_DEFAULT_WINNING_POINTS,
	SPLENDOR_PLAYER_COUNTS,
	SPLENDOR_WINNING_POINTS
} from "@/games/splendor/shared/schema.ts";
import { RadioSelect } from "@/shared/ui/primitives/radio-select.tsx";
import { CreateGame } from "@/swish/client/create-game.tsx";

import type { SplendorCreateInput } from "@/games/splendor/shared/schema.ts";

type PlayerCount = SplendorCreateInput[ "playerCount" ];
type WinningPoints = typeof SPLENDOR_WINNING_POINTS[number];

export function SplendorCreateGame() {
	const [ playerCount, setPlayerCount ] = useState<PlayerCount>();
	const [ winningPoints, setWinningPoints ] = useState<WinningPoints>(
		SPLENDOR_DEFAULT_WINNING_POINTS
	);

	// The move clock and the manual start stay the server's to fix.
	const createSplendorGame = () =>
		splendorApi.createGame( { playerCount: playerCount!, winningPoints } );

	return (
		<CreateGame
			game={ "splendor" }
			disabled={ !playerCount }
			createGame={ createSplendorGame }
		>
			<div className={ "flex flex-col gap-2" }>
				<label className={ "text-sm text-muted-foreground" }>Player Count</label>
				<RadioSelect
					options={ SPLENDOR_PLAYER_COUNTS }
					value={ playerCount }
					onChange={ setPlayerCount }
				/>

				<label className={ "text-sm text-muted-foreground" }>Winning Points</label>
				<RadioSelect
					options={ SPLENDOR_WINNING_POINTS }
					value={ winningPoints }
					onChange={ v => v !== undefined && setWinningPoints( v ) }
					allowDeselect={ false }
				/>
			</div>
		</CreateGame>
	);
}
