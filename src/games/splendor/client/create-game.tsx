"use client";

import { useState } from "react";

import { CreateGame } from "@/shared/ui/components/create-game.tsx";
import { RadioSelect } from "@/shared/ui/primitives/radio-select.tsx";
import { createSplendorGameFn } from "@/games/splendor/client/client.ts";

export function SplendorCreateGame() {
	const [ playerCount, setPlayerCount ] = useState<2 | 3 | 4>();
	const [ winningPoints, setWinningPoints ] = useState<10 | 15 | 20>( 15 );

	const createSplendorGame = async (): Promise<string> => {
		if ( !playerCount || !winningPoints ) {
			return "";
		}
		const { id } = await createSplendorGameFn( {
			playerCount,
			autoStart: true,
			winningPoints
		} );
		return id;
	};

	return (
		<CreateGame
			game={ "splendor" }
			disabled={ !playerCount }
			createGame={ createSplendorGame }
		>
			<div className={ "flex flex-col gap-2" }>
				<label className={ "text-sm text-muted-foreground" }>
					Player Count
				</label>
				<RadioSelect
					options={ [ 2, 3, 4 ] as const }
					value={ playerCount }
					onChange={ setPlayerCount }
				/>

				<label className={ "text-sm text-muted-foreground" }>
					Winning Points
				</label>
				<RadioSelect
					options={ [ 10, 15, 20 ] as const }
					value={ winningPoints }
					onChange={ v => v !== undefined && setWinningPoints( v ) }
					allowDeselect={ false }
				/>
			</div>
		</CreateGame>
	);
}
