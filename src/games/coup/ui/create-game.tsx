import { useAtomSet, useAtomValue } from "@effect/atom-react";

import { useState } from "react";

import {
	COUP_CARD_COPIES,
	COUP_CHARACTERS,
	COUP_DEFAULT_PLAYERS,
	COUP_MAX_PLAYERS,
	COUP_MIN_PLAYERS,
	COUP_STARTING_INFLUENCE
} from "@/games/coup/schema";
import { createGameAtom } from "@/games/coup/ui/client";
import { RadioSelect } from "@/shared/primitives/radio-select";
import { CreateGame } from "@/swish/ui/create-game";


/** Twenty: four copies of each of the five characters. */
const DECK_SIZE = COUP_CHARACTERS.length * COUP_CARD_COPIES;

/** Every table size the deck supports, two through six. */
const PLAYER_COUNTS = Array.from(
	{ length: COUP_MAX_PLAYERS - COUP_MIN_PLAYERS + 1 },
	( _, index ) => COUP_MIN_PLAYERS + index
);

/**
 * The lobby. The table size is the only thing there is to choose — Coup has no
 * variants, and the deck is the same twenty cards however many people sit round
 * it — six seats still leave eight face down.
 */
export function CoupCreateGame() {
	const [ playerCount, setPlayerCount ] = useState<number>( COUP_DEFAULT_PLAYERS );

	const create = useAtomSet( createGameAtom, { mode: "promise" } );
	const creating = useAtomValue( createGameAtom ).waiting;

	return (
		<CreateGame
			game={ "coup" }
			disabled={ creating }
			createGame={ ( { isPrivate } ) => create( { payload: { playerCount, isPrivate } } ) }
		>
			<div className={ "flex flex-col gap-3" }>
				<label className={ "text-sm text-muted-foreground" }>Players</label>
				<RadioSelect
					options={ PLAYER_COUNTS }
					value={ playerCount }
					onChange={ value => value !== undefined && setPlayerCount( value ) }
					allowDeselect={ false }
					renderOption={ count => <span className={ "text-sm" }>{ count }</span> }
				/>
				<p className={ "text-xs text-muted-foreground" }>
					{ playerCount === 2
						? "Two players is a duel — every bluff is aimed at one person."
						: `${ playerCount } players, ${ DECK_SIZE -
						playerCount *
						COUP_STARTING_INFLUENCE } cards left in the deck.` }
				</p>
			</div>
		</CreateGame>
	);
}
