"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import { wordleApi } from "@/games/wordle/client/client.ts";
import {
	WORDLE_MAX_PLAYER_COUNT,
	WORDLE_MAX_WORD_COUNT
} from "@/games/wordle/shared/schema.ts";
import { Button } from "@/shared/ui/primitives/button.tsx";
import { RadioSelect } from "@/shared/ui/primitives/radio-select.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";
import { CreateGame } from "@/swish/client/create-game.tsx";

import type { WordLength } from "@/games/wordle/shared/schema.ts";

/** The seat counts the lobby offers. One is solitaire; the rest are duels. */
const PLAYER_COUNTS = [ 1, 2, 3, 4, 6, WORDLE_MAX_PLAYER_COUNT ] as const;

type CounterProps = {
	label: string;
	value: number;
	min: number;
	max: number;
	onChange: ( value: number ) => void;
};

function Counter( { label, value, min, max, onChange }: CounterProps ) {
	return (
		<div className={ "flex flex-col gap-2" }>
			<label className={ "text-sm text-muted-foreground" }>{ label }</label>
			<div className={ "flex justify-center items-center gap-2" }>
				<Button size={ "icon" } onClick={ () => onChange( value - 1 ) } disabled={ value <= min }>
					<MinusIcon className={ "h-4 w-4" }/>
				</Button>
				<div
					className={ cn(
						"flex-1 h-8 md:h-10 flex items-center justify-center",
						"border bg-surface text-sm border-outline rounded-md"
					) }
				>
					{ value }
				</div>
				<Button size={ "icon" } onClick={ () => onChange( value + 1 ) } disabled={ value >= max }>
					<PlusIcon className={ "h-4 w-4" }/>
				</Button>
			</div>
		</div>
	);
}

/**
 * The lobby. Everything here shapes the board every seat then races on — the
 * seats included, since a duel is nothing but `playerCount > 1`: the same words,
 * a board each, and the scores compared at the end.
 */
export function WordleCreateGame() {
	const [ playerCount, setPlayerCount ] = useState<number>( 1 );
	const [ wordLength, setWordLength ] = useState<WordLength>( 5 );
	const [ wordCount, setWordCount ] = useState( 1 );

	const createWordleGame = () => wordleApi.createGame( { playerCount, wordCount, wordLength } );

	return (
		<CreateGame game={ "wordle" } createGame={ createWordleGame }>
			<div className={ "flex flex-col gap-3" }>
				<label className={ "text-sm text-muted-foreground" }>Players</label>
				<RadioSelect
					options={ PLAYER_COUNTS }
					value={ playerCount }
					onChange={ v => v !== undefined && setPlayerCount( v ) }
					allowDeselect={ false }
					renderOption={ count => (
						<span className={ "text-sm" }>{ count === 1 ? "SOLO" : count }</span>
					) }
				/>

				<Counter
					label={ "Number of Words" }
					value={ wordCount }
					min={ 1 }
					max={ WORDLE_MAX_WORD_COUNT }
					onChange={ setWordCount }
				/>

				<label className={ "text-sm text-muted-foreground" }>Word Length</label>
				<RadioSelect
					options={ [ 4, 5, 6 ] as const }
					value={ wordLength }
					onChange={ v => v !== undefined && setWordLength( v ) }
					allowDeselect={ false }
				/>

				<p className={ "text-xs text-muted-foreground" }>
					{ wordCount + wordLength } guesses each
					{ playerCount > 1 && ", every seat racing the same words" }.
				</p>
			</div>
		</CreateGame>
	);
}
