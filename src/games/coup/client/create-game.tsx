"use client";

import { useState } from "react";

import { coupApi } from "@/games/coup/client/client.ts";
import { COUP_PLAYER_COUNTS } from "@/games/coup/shared/schema.ts";
import { RadioSelect } from "@/shared/ui/primitives/radio-select.tsx";
import { CreateGame } from "@/swish/client/create-game.tsx";

import type { CoupCreateInput } from "@/games/coup/shared/schema.ts";
import type { TableVisibility } from "@/swish/shared/schema.ts";

type PlayerCount = CoupCreateInput[ "playerCount" ];

export function CoupCreateGame() {
	const [ playerCount, setPlayerCount ] = useState<PlayerCount>();

	// The move clock, the reaction clock and the manual start stay the server's
	// to fix — a table only chooses how many seats to lay out.
	const createCoupGame = ( visibility: TableVisibility ) => coupApi.createGame( {
		config: { playerCount: playerCount! },
		...visibility
	} );

	return (
		<CreateGame
			game={ "coup" }
			disabled={ !playerCount }
			createGame={ createCoupGame }
		>
			<div className={ "flex flex-col gap-2" }>
				<label className={ "text-sm text-muted-foreground" }>Player Count</label>
				<RadioSelect
					options={ COUP_PLAYER_COUNTS }
					value={ playerCount }
					onChange={ setPlayerCount }
				/>
			</div>
		</CreateGame>
	);
}
