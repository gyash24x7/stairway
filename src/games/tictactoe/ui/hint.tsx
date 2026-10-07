import type { TicTacToeHint } from "@/games/tictactoe/schema";
import { hintAtom } from "@/games/tictactoe/ui/client";
import { GameId } from "@/swish/schema";
import { HintButton, NO_HINT, useHint } from "@/swish/ui/hint";


/**
 * The nine squares in words.
 *
 * A board position is an index into a flat array, which is the right shape to
 * play with and the wrong one to be told about — "PLAY 4" means nothing without
 * the board in front of you and counting along it. Naming them is the whole of
 * what turns the policy's answer into advice.
 */
const SQUARES = [
	"TOP LEFT",
	"TOP MIDDLE",
	"TOP RIGHT",
	"MIDDLE LEFT",
	"THE CENTRE",
	"MIDDLE RIGHT",
	"BOTTOM LEFT",
	"BOTTOM MIDDLE",
	"BOTTOM RIGHT"
] as const;

export const describeHint = ( { move }: TicTacToeHint ) =>
	move
		? `PLAY ${ SQUARES[ move.input.position ] ?? `SQUARE ${ move.input.position + 1 }` }`
		: NO_HINT;

export type TicTacToeHintProps = {
	readonly gameId: string;
	readonly disabled?: boolean;
};

export function TicTacToeHint( { gameId, disabled }: TicTacToeHintProps ) {
	const request = { params: { gameId: GameId.make( gameId ) } };
	return <HintButton { ...useHint( hintAtom, request, describeHint ) } disabled={ disabled }/>;
}
