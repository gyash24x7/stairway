"use client";

import { useState } from "react";

import type { BookType } from "@/games/fish/shared/schema.ts";
import { buildConfig } from "@/games/fish/shared/utils.ts";
import { CreateGame } from "@/shared/ui/components/create-game.tsx";
import { RadioSelect } from "@/shared/ui/primitives/radio-select.tsx";
import { createFishGameFn } from "@/games/fish/client/client.ts";

export function FishCreateGame() {
	const [ playerCount, setPlayerCount ] = useState<4 | 6 | 8>();
	const [ teamCount, setTeamCount ] = useState<2 | 3 | 4>();
	const [ bookType, setBookType ] = useState<BookType>( "NORMAL" );

	const createFishGame = async () => {
		if ( !playerCount || !teamCount ) {
			return "";
		}
		const config = buildConfig( playerCount, bookType, teamCount );
		const { id } = await createFishGameFn( config );
		return id;
	};

	return (
		<CreateGame
			game={ "fish" }
			disabled={ !playerCount || !teamCount }
			createGame={ createFishGame }
		>
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
