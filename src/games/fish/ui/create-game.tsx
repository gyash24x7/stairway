import { useAtomSet } from "@effect/atom-react";

import { useState } from "react";

import type { BookType, TeamCount } from "@/games/fish/schema";
import { PlayerCount } from "@/games/fish/schema";
import { createGameAtom } from "@/games/fish/ui/client";
import { teamCountsFor } from "@/games/fish/utils";
import { RadioSelect } from "@/shared/primitives/radio-select";
import type { CreateGameOptions } from "@/swish/ui/create-game";
import { CreateGame } from "@/swish/ui/create-game";


/**
 * The lobby. Only three things are the client's say — seats, variant and how many
 * sides — and everything else about the table (the deck, the books, how big a
 * book is, the sides' ids and the move clock) follows from them server-side.
 *
 * The side count is offered from `teamCountsFor` rather than as a fixed list:
 * swish sides are equal-sized, so a count that does not divide the seats evenly
 * is one `initialize` would refuse outright.
 */
export function FishCreateGame() {
	const createGame = useAtomSet( createGameAtom, { mode: "promise" } );

	const [ playerCount, setPlayerCount ] = useState<PlayerCount>();
	const [ teamCount, setTeamCount ] = useState<TeamCount>();
	const [ bookType, setBookType ] = useState<BookType>( "NORMAL" );

	const teamCounts = playerCount ? teamCountsFor( playerCount ) : [];

	const handlePlayerCount = ( count: PlayerCount | undefined ) => {
		setPlayerCount( count );
		// A side count that no longer divides the new seat count would be refused.
		if ( count === undefined || !teamCount || !teamCountsFor( count ).includes( teamCount ) ) {
			setTeamCount( undefined );
		}
	};

	const submit = ( { isPrivate }: CreateGameOptions ) => createGame( {
		payload: { playerCount: playerCount!, type: bookType, teamCount: teamCount!, isPrivate }
	} );

	return (
		<CreateGame
			game={ "fish" }
			disabled={ !playerCount || !teamCount }
			createGame={ submit }
		>
			<div className={ "flex flex-col gap-2" }>
				<label className={ "text-sm text-muted-foreground" }>Player Count</label>
				<RadioSelect
					options={ PlayerCount.literals }
					value={ playerCount }
					onChange={ handlePlayerCount }
				/>

				<label className={ "text-sm text-muted-foreground" }>Team Count</label>
				<RadioSelect
					options={ teamCounts }
					value={ teamCount }
					onChange={ setTeamCount }
				/>
				{ !playerCount && (
					<p className={ "text-xs text-muted-foreground" }>Pick a player count first.</p>
				) }

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
