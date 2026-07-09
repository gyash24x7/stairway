"use client";

import { client } from "@/api/client";
import type { BookType } from "@/fish/core/types";
import { CreateGame } from "@/shared/components/create-game";
import { RadioSelect } from "@/shared/primitives/radio-select";
import { useState } from "react";

export function FishCreateGame() {
	const [ playerCount, setPlayerCount ] = useState<4 | 6 | 8>();
	const [ teamCount, setTeamCount ] = useState<2 | 3 | 4>();
	const [ bookType, setBookType ] = useState<BookType>( "NORMAL" );

	const createFishGame = async () => {
		if ( !!playerCount && !!teamCount ) {
			return client.fish.createGame( { playerCount, type: bookType, teamCount } );
		}
		return "";
	};

	return (
		<CreateGame game={ "fish" } disabled={ !playerCount } createGame={ createFishGame }>
			<div className={ "flex flex-col gap-2" }>
				<label className={ "text-sm text-muted-foreground" }>Player Count</label>
				<RadioSelect
					options={ [ 4, 6, 8 ] as const }
					value={ playerCount }
					onChange={ setPlayerCount }
				/>

				<label className={ "text-sm text-muted-foreground" }>Team Count</label>
				<RadioSelect
					options={ [ 2, 3, 4 ] as const }
					value={ teamCount }
					onChange={ setTeamCount }
				/>

				<label className={ "text-sm text-muted-foreground" }>Game Type</label>
				<RadioSelect
					options={ [ "NORMAL", "CANADIAN" ] as const }
					value={ bookType }
					onChange={ v => v !== undefined && setBookType( v ) }
					allowDeselect={ false }
				/>
			</div>
		</CreateGame>
	);
}
