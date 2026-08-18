"use client";

import { CheckCircle2Icon, FlagIcon } from "lucide-react";

import { WordleGrid } from "@/games/wordle/client/board.tsx";
import { useWordle } from "@/games/wordle/client/context.tsx";
import { CounterTween } from "@/shared/ui/components/counter-tween.tsx";
import { StandingsTable } from "@/swish/client/standings-table.tsx";

import type { StandingsColumn, StandingsRow } from "@/swish/client/standings-table.tsx";

type DuelRow = StandingsRow & {
	solved: number;
	guessCount: number;
	score: number;
};

const NARROW = { base: "w-16", large: "w-32" };

/**
 * The live race: one row per seat, in seating order.
 *
 * Every figure here is public — how many guesses a seat has spent, how many
 * words it has solved and what it would score if the game ended now. The rows
 * themselves are not, which is the whole reason this exists: a rival's grid is
 * redacted until the game is decided, so the scoreboard is how a duel is
 * actually followed.
 *
 * It renders through `StandingsTable`, the same chrome the final standings use,
 * so the table a duel is followed in and the table it ends on are the same
 * object rather than two implementations of one design.
 */
export function DuelScoreboard() {
	const { data } = useWordle();
	const wordCount = data.config.wordCount;
	const maxGuesses = data.view.maxGuesses;

	// `boards` is built from the seating order, so leading is only about display —
	// the engine's own standings decide the game.
	const leaderScore = Math.max( ...data.view.boards.map( board => board.score ) );

	const rows: DuelRow[] = data.view.boards.map( board => ( {
		playerId: board.playerId,
		isMe: board.playerId === data.view.playerId,
		highlight: board.score > 0 && board.score === leaderScore,
		solved: board.solvedWords.filter( Boolean ).length,
		guessCount: board.guessCount,
		score: board.score,
		trailing: board.finished
			? (
				board.solvedWords.every( Boolean )
					? <CheckCircle2Icon className={ "w-4 h-4 shrink-0" }/>
					: <FlagIcon className={ "w-4 h-4 shrink-0 opacity-60" }/>
			)
			: undefined
	} ) );

	const columns: StandingsColumn<DuelRow>[] = [
		{
			key: "solved",
			label: "SOLVED",
			width: NARROW,
			render: row => `${ row.solved }/${ wordCount }`
		},
		{
			key: "guesses",
			label: "GUESSES",
			width: NARROW,
			render: row => `${ row.guessCount }/${ maxGuesses }`
		},
		{
			key: "score",
			label: "SCORE",
			width: NARROW,
			render: row => <CounterTween value={ row.score }/>
		}
	];

	return <StandingsTable rows={ rows } columns={ columns } players={ data.players }/>;
}

/**
 * Every rival's finished board, shown once the game is decided and the engine
 * stops redacting them. Before that a rival's `results` are empty and there is
 * nothing here worth the space, so this renders nothing.
 */
export function RivalBoards() {
	const { data } = useWordle();

	const rivals = data.view.boards.filter( board => board.playerId !== data.view.playerId );
	if ( !data.view.decided || rivals.length === 0 ) {
		return null;
	}

	return (
		<div className={ "flex flex-col gap-3 w-full" }>
			<p className={ "text-metric-label" }>EVERYONE ELSE</p>
			<div className={ "flex flex-wrap gap-4 justify-center" }>
				{ rivals.map( board => (
					<div key={ board.playerId } className={ "flex flex-col gap-2 items-center" }>
						<span className={ "text-sm font-heading" }>
							{ ( data.players[ board.playerId ]?.name ?? board.playerId ).toUpperCase() }
						</span>
						<WordleGrid
							board={ board }
							wordLength={ data.config.wordLength }
							maxGuesses={ data.view.maxGuesses }
							answers={ data.view.answers }
							compact
						/>
					</div>
				) ) }
			</div>
		</div>
	);
}
