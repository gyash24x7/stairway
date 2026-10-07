import { CheckCircle2Icon, FlagIcon } from "lucide-react";

import type { WordleConfig, WordleView } from "@/games/wordle/schema";
import { WordleGrid } from "@/games/wordle/ui/board";
import { CounterTween } from "@/shared/shell/counter-tween";
import type { GameView, PlayerId } from "@/swish/schema";
import type { StandingsColumn, StandingsRow } from "@/swish/ui/standings-table";
import { StandingsTable } from "@/swish/ui/standings-table";


type Game = GameView<WordleView, WordleConfig>;

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
export function DuelScoreboard( { game, me }: { game: Game; me?: PlayerId } ) {
	const wordCount = game.config.wordCount;
	const maxGuesses = game.view.maxGuesses;

	// `boards` is built from the seating order, so leading is only about display —
	// the engine's own standings decide the game.
	const leaderScore = Math.max( ...game.view.boards.map( board => board.score ) );

	const rows: DuelRow[] = game.view.boards.map( board => ( {
		playerId: board.playerId,
		isMe: board.playerId === me,
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

	return <StandingsTable rows={ rows } columns={ columns } players={ game.players }/>;
}

/**
 * Everyone else's boards.
 *
 * Gated on whether the rows actually arrived rather than on the game being
 * over, because those are no longer the same question. A player's rivals stay
 * redacted until the game is decided, so for them this still appears only at
 * the end; a spectator holds no seat in the race and is sent every row as it
 * happens, so for them it is the live board — which is the whole of what there
 * is to watch, a wordle being a race nobody can otherwise see.
 *
 * Reading the data instead of a flag is what keeps those two cases from needing
 * two components: whoever has rows sees boards, and whoever has none sees
 * nothing rather than a grid of blanks.
 *
 * The same split decides the size. `compact` drops the letters and shrinks a
 * tile to a few pixels — a shape to recognise a finished game by, which is all
 * a player wants beside their own board. A watcher has no board of their own
 * and is reading the race as it runs, so they get the grid at full size with
 * the guesses legible.
 */
export function RivalBoards( { game, me }: { game: Game; me?: PlayerId } ) {
	const rivals = game.view.boards.filter( board => board.playerId !== me );
	const hasRows = rivals.some( board => board.guesses.length > 0 );
	if ( rivals.length === 0 || ( !game.view.decided && !hasRows ) ) {
		return null;
	}

	return (
		<div className={ "flex flex-col gap-3 w-full" }>
			<p className={ "text-metric-label" }>{ me ? "EVERYONE ELSE" : "EVERY BOARD" }</p>
			<div className={ "flex flex-wrap gap-4 justify-center" }>
				{ rivals.map( board => (
					<div key={ board.playerId } className={ "flex flex-col gap-2 items-center" }>
						<span className={ "text-sm font-heading" }>
							{ ( game.players[ board.playerId ]?.name ?? board.playerId ).toUpperCase() }
						</span>
						<WordleGrid
							board={ board }
							wordLength={ game.config.wordLength }
							maxGuesses={ game.view.maxGuesses }
							answers={ game.view.answers }
							compact={ !!me }
						/>
					</div>
				) ) }
			</div>
		</div>
	);
}
