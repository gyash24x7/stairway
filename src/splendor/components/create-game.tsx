"use client";

import { CreateGame } from "@/shared/components/create-game";
import { RadioSelect } from "@/shared/primitives/radio-select";
import { createGame } from "@/splendor/core/actions";
import { useState } from "react";

export function SplendorCreateGame() {
	const [ playerCount, setPlayerCount ] = useState<2 | 3 | 4>();
	const [ winningPoints, setWinningPoints ] = useState<10 | 15 | 20>( 15 );

	const createSplendorGame = async () => {
		if ( !!playerCount && !!winningPoints ) {
			return createGame( { playerCount, winningPoints } );
		}
		return "";
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
