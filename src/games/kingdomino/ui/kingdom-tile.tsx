import { cn } from "cn";
import { motion } from "framer-motion";

import type { KingdominoConfig, KingdominoView } from "@/games/kingdomino/schema";
import type { SmallBoardSize } from "@/games/kingdomino/ui/board";
import { RSmallBoard } from "@/games/kingdomino/ui/board";
import { RSmallDomino } from "@/games/kingdomino/ui/domino";
import { DOMINO_DECK } from "@/games/kingdomino/utils";
import { Avatar, AvatarImage } from "@/shared/primitives/avatar";
import { CounterTween } from "@/shared/shell/counter-tween";
import { FloatPlusN } from "@/shared/shell/float-plus-n";
import type { GameView, PlayerId } from "@/swish/schema";


type Game = GameView<KingdominoView, KingdominoConfig>;

/**
 * How large a kingdom can render before it stops fitting its share of the couch
 * screen. Height is the binding constraint: the centre stage is roughly 1210x730
 * on the 1920x1080 canvas, so four seats get about 290px of board each once the
 * tile header is paid for. The widest grid a kingdom ever draws is `boardSize`
 * plus a one-cell ring of candidates — 7 across at `boardSize` 5, 9 at 7.
 *
 * @param players - How many seats are at the table.
 * @param boardSize - The configured kingdom size (5 or 7).
 * @returns The cell size the tiles should use.
 */
export const kingdomBoardSize = ( players: number, boardSize: number ) =>
	players <= 2 ? "lg" : boardSize >= 7 ? "sm" : "md";

export type KingdomTileProps = {
	data: Game;
	playerId: PlayerId;
	/** Cell size for the kingdom grid — see `kingdomBoardSize`. */
	size?: SmallBoardSize;
	/** Hide the pending-dominoes strip once there are no more turns to take. */
	showQueue?: boolean;
	/**
	 * Drop the kingdom itself and keep only the seat header. The couch rail uses
	 * this once the standings take the centre stage — four boards will not fit a
	 * third of the screen at a readable size, but four faces will.
	 */
	showBoard?: boolean;
};

/**
 * One seat's kingdom on the shared screen: who they are, what they've scored,
 * what they still have to place, and the board itself.
 *
 * Reads the *table* view passed in, so it renders identically from the player
 * snapshot and the table snapshot — a kingdom is public in Kingdomino, the only
 * hidden state is the undrawn deck.
 */
export function KingdomTile(
	{ data, playerId, size = "md", showQueue = true, showBoard = true }: KingdomTileProps
) {
	const baseInfo = data.players[ playerId ];
	const playerData = data.view.playerData[ playerId ];
	const points = playerData?.score.points ?? 0;

	const isCurrentTurn = data.status === "IN_PROGRESS"
		&& data.context.currentPlayer === playerId;

	const queue = [ ...( playerData?.queue ?? [] ) ].toSorted( ( a, b ) => a - b );

	return (
		<motion.div
			layout
			className={ cn(
				"bg-background rounded-xl overflow-hidden min-h-0",
				"flex flex-col gap-2 p-4 items-center justify-start transition-shadow",
				// A steady ring. This is a television across a room, where a kingdom
				// flashing on a loop for the whole of someone's turn is unwatchable.
				isCurrentTurn && "ring-6 ring-accent"
			) }
		>
			<div className={ "flex gap-4 items-center w-full shrink-0" }>
				<Avatar className={ "rounded-full w-14 h-14 shrink-0" }>
					<AvatarImage src={ baseInfo?.avatar } alt={ "" } className={ "bg-accent" }/>
				</Avatar>
				<span className={ "text-3xl font-heading truncate" }>
					{ baseInfo?.name?.split( " " )[ 0 ] }
				</span>
				{ showQueue && (
					<div className={ "flex gap-2 flex-1 min-w-0 justify-end" }>
						{ queue.flatMap( dominoId => {
							const domino = DOMINO_DECK[ dominoId - 1 ];
							return domino
								? [ <RSmallDomino key={ dominoId } domino={ domino } enabled={ false }/> ]
								: [];
						} ) }
					</div>
				) }
				<div className={ cn( "relative shrink-0", !showQueue && "flex-1 text-right" ) }>
					<span className={ "text-5xl font-heading" }>
						<CounterTween value={ points }/>
					</span>
					<FloatPlusN value={ points } className={ "text-2xl" }/>
				</div>
			</div>
			{ showBoard && playerData && (
				<div className={ "flex-1 min-h-0 flex items-center justify-center" }>
					<RSmallBoard board={ playerData.board } size={ size }/>
				</div>
			) }
		</motion.div>
	);
}
