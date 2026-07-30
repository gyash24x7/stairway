"use client";

import type { BookType } from "@/games/fish/shared/schema";
import { CreateGame } from "@/ui/components/create-game";
import { RadioSelect } from "@/ui/primitives/radio-select";
import { buildConfig } from "@/games/fish/shared/utils";
import { useState } from "react";
import { createFishGameFn } from "./client";

export function FishCreateGame() {
	const [ playerCount, setPlayerCount ] = useState<4 | 6 | 8>();
	const [ teamCount, setTeamCount ] = useState<2 | 3 | 4>();
	const [ bookType, setBookType ] = useState<BookType>( "NORMAL" );

	const createFishGame = async (): Promise<string> => {
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
