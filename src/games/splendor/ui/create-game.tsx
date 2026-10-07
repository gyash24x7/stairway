import { useAtomSet } from "@effect/atom-react";

import { useState } from "react";

import type { SplendorCreateInput } from "@/games/splendor/schema";
import {
	SPLENDOR_DEFAULT_WINNING_POINTS,
	SPLENDOR_PLAYER_COUNTS,
	SPLENDOR_WINNING_POINTS
} from "@/games/splendor/schema";
import { createGameAtom } from "@/games/splendor/ui/client";
import { RadioSelect } from "@/shared/primitives/radio-select";
import { CreateGame } from "@/swish/ui/create-game";

type PlayerCount = SplendorCreateInput[ "playerCount" ];
type WinningPoints = typeof SPLENDOR_WINNING_POINTS[number];

export function SplendorCreateGame() {
	const createGame = useAtomSet( createGameAtom, { mode: "promise" } );

	const [ playerCount, setPlayerCount ] = useState<PlayerCount>();
	const [ winningPoints, setWinningPoints ] = useState<WinningPoints>(
		SPLENDOR_DEFAULT_WINNING_POINTS
	);

	return (
		<CreateGame
			game={ "splendor" }
			disabled={ !playerCount }
			createGame={ ( { isPrivate } ) => createGame( {
				payload: {
					playerCount: playerCount ?? 2,
					winningPoints,
					isPrivate
				}
			} ) }
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
