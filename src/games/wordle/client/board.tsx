"use client";

import { motion } from "framer-motion";
import { CheckIcon } from "lucide-react";

import { useWordle } from "@/games/wordle/client/context.tsx";
import { SPRING } from "@/shared/ui/utils/animation.ts";
import { cn } from "@/shared/ui/utils/cn.ts";

import type { Board, LetterStatus } from "@/games/wordle/shared/schema.ts";

const STATUS_CLASS: Record<LetterStatus, string> = {
	correct: "bg-green-500 text-white border-green-600",
	present: "bg-amber-500 text-white border-amber-600",
	absent: "bg-neutral-400/50 text-muted-foreground border-neutral-400"
};

/**
 * One scored row, or the row being typed into, or an untouched one.
 *
 * `statuses` and `letters` are index-aligned by construction: the column holds
 * `results[ w ][ i ]` for `guesses[ i ]`, so a row is either fully scored or has
 * no statuses at all.
 */
type RowProps = {
	letters: string;
	statuses?: readonly LetterStatus[];
	wordLength: number;
	shake?: boolean;
	reveal?: boolean;
	done?: boolean;
	compact?: boolean;
};

/** How long one tile takes to turn, and how far apart the tiles start. */
const FLIP_S = 0.5;
const TILE_STAGGER_S = 0.1;

function Row( { letters, statuses, wordLength, shake, reveal, done, compact }: RowProps ) {
	return (
		<motion.div
			className={ "flex gap-0.5 md:gap-1" }
			animate={ shake ? { x: [ 0, -6, 6, -6, 6, -3, 3, 0 ] } : { x: 0 } }
			transition={ { duration: 0.5 } }
		>
			{ Array.from( { length: wordLength } ).map( ( _, index ) => {
				const status = statuses?.[ index ];
				const letter = letters.charAt( index ).toUpperCase();
				const revealing = !!reveal && !!status;

				return (
					<motion.div
						key={ `tile-${ index }` }
						className={ cn(
							"border rounded flex items-center justify-center font-semibold",
							"border-outline transition-colors",
							compact
								? "w-4 h-4 md:w-5 md:h-5 text-[8px]"
								: "w-7 h-7 sm:w-9 sm:h-9 md:w-11 md:h-11 text-base sm:text-lg md:text-xl",
							status ? STATUS_CLASS[ status ] : "bg-background",
							!status && done && "bg-transparent border-dashed opacity-40",
							!status && !!letter && "border-foreground",
							!status && shake && "border-destructive"
						) }
						style={ {
							perspective: 600,
							// The colour lands as the tile is edge-on, halfway through its
							// own turn — the point of the flip is that the tile is face
							// down when it changes. Colouring it upfront, as this did,
							// made the rotation read as a wobble on an already-scored row.
							transitionDelay: revealing ? `${ index * TILE_STAGGER_S + FLIP_S / 2 }s` : "0s",
							transitionDuration: revealing ? "0s" : undefined
						} }
						initial={ false }
						animate={ revealing ? { rotateX: [ 0, 90, 0 ] } : { rotateX: 0 } }
						transition={ revealing
							? {
								duration: FLIP_S,
								times: [ 0, 0.5, 1 ],
								delay: index * TILE_STAGGER_S,
								ease: "easeInOut"
							}
							: { duration: 0 }
						}
					>
						{ !compact && !!letter && (
							<motion.span
								key={ `${ letter }-${ status ?? "typed" }` }
								initial={ !status ? { scale: 0.6, opacity: 0 } : false }
								animate={ { scale: 1, opacity: 1 } }
								transition={ { type: "spring", stiffness: 500, damping: 20 } }
							>
								{ letter }
							</motion.span>
						) }
					</motion.div>
				);
			} ) }
		</motion.div>
	);
}

export type WordleGridProps = {
	board: Board;
	wordLength: number;
	maxGuesses: number;
	currentGuess?: string;
	invalidGuess?: boolean;
	lastRevealedRow?: number | null;
	answers?: readonly string[];
	compact?: boolean;
};

/**
 * One seat's board: a column per hidden word, `maxGuesses` rows deep.
 *
 * Every column is drawn to the full allowance rather than to the rows it has
 * scored, so the columns of a board stay in step even after one of them is
 * solved — a short column would otherwise slide its neighbours' rows out of
 * alignment, and a row's index is the guess that made it.
 *
 * A rival's board arrives with `guesses` and `results` empty (the engine redacts
 * them, since every seat is racing the same words), so this renders as an empty
 * grid for them until the game is decided. Their progress is on the scoreboard.
 */
export function WordleGrid( props: WordleGridProps ) {
	const { board, wordLength, maxGuesses, compact } = props;
	const rows = Array.from( { length: maxGuesses }, ( _, index ) => index );

	return (
		<div
			className={ cn(
				"flex flex-wrap justify-center",
				compact ? "gap-2" : "gap-2 md:gap-3"
			) }
		>
			{ board.results.length === 0 && board.solvedWords.map( ( solved, wordIndex ) => (
				<EmptyColumn
					key={ `empty-word-${ wordIndex }` }
					solved={ solved }
					rows={ rows }
					wordLength={ wordLength }
					compact={ compact }
				/>
			) ) }

			{ board.results.map( ( column, wordIndex ) => {
				const solved = board.solvedWords[ wordIndex ] ?? false;
				// The next open row of an unsolved column is where the typed word goes.
				const typingRow = solved ? -1 : column.length;

				return (
					<div
						key={ `word-${ wordIndex }` }
						className={ "flex flex-col gap-0.5 md:gap-1 items-center" }
					>
						{ rows.map( index => {
							const spent = index >= column.length;
							const typed = index === typingRow;

							return (
								<Row
									key={ `row-${ index }` }
									letters={ typed
										? ( props.currentGuess ?? "" )
										: spent ? "" : ( board.guesses[ index ] ?? "" ) }
									statuses={ column[ index ] }
									wordLength={ wordLength }
									shake={ typed && props.invalidGuess }
									reveal={ props.lastRevealedRow === index }
									done={ solved && spent }
									compact={ compact }
								/>
							);
						} ) }
						<ColumnFooter
							solved={ solved }
							answer={ props.answers?.[ wordIndex ] }
							compact={ compact }
						/>
					</div>
				);
			} ) }
		</div>
	);
}

/** A redacted column: the right shape, with nothing in it. */
function EmptyColumn( props: {
	solved: boolean;
	rows: number[];
	wordLength: number;
	compact?: boolean;
} ) {
	return (
		<div className={ "flex flex-col gap-0.5 md:gap-1 items-center" }>
			{ props.rows.map( index => (
				<Row
					key={ `row-${ index }` }
					letters={ "" }
					wordLength={ props.wordLength }
					compact={ props.compact }
				/>
			) ) }
			<ColumnFooter solved={ props.solved } compact={ props.compact }/>
		</div>
	);
}

function ColumnFooter( props: { solved: boolean; answer?: string; compact?: boolean } ) {
	if ( props.answer ) {
		return (
			<motion.span
				className={ cn(
					"font-heading",
					props.compact ? "text-[10px]" : "text-sm md:text-lg",
					props.solved ? "text-green-500" : "text-foreground/60"
				) }
				initial={ { opacity: 0, scale: 0.7 } }
				animate={ { opacity: 1, scale: 1 } }
				transition={ SPRING }
			>
				{ props.answer.toUpperCase() }
			</motion.span>
		);
	}

	return (
		<span className={ cn( "h-4", props.compact && "h-3" ) }>
			{ props.solved && (
				<CheckIcon className={ cn( "text-green-500", props.compact ? "w-3 h-3" : "w-4 h-4" ) }/>
			) }
		</span>
	);
}

/** The viewing seat's own board, wired to the keyboard. */
export function OwnBoard() {
	const { data, board, currentGuess, invalidGuess, lastRevealedRow } = useWordle();

	return (
		<WordleGrid
			board={ board }
			wordLength={ data.config.wordLength }
			maxGuesses={ data.view.maxGuesses }
			currentGuess={ currentGuess }
			invalidGuess={ invalidGuess }
			lastRevealedRow={ lastRevealedRow }
			answers={ data.view.answers }
		/>
	);
}
