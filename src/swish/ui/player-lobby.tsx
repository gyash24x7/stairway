import { cn } from "cn";

import type { PlayerInfo } from "@/swish/schema";
import { RPlayerInfo } from "@/swish/ui/player-info";


export type PlayerLobbyGridProps = {
	/** The seats already taken, in seat order. */
	readonly players: ReadonlyArray<PlayerInfo>;
	/**
	 * Total seats at the table. Supplied, the grid pads out to it with empty
	 * placeholders, so the room can see how many people are still missing rather
	 * than having to read it off a counter.
	 */
	readonly seats?: number;
	/** Television sizing — used by the couch screens' lobby. */
	readonly large?: boolean;
	readonly className?: string;
};

/**
 * One empty seat, so a half-full table reads as half full rather than small.
 *
 * Carries the same width floor as the seats beside it, so an empty place wraps
 * onto the next line at the same point a taken one does.
 */
function EmptySeat( { large }: { large?: boolean } ) {
	return (
		<div
			className={ cn(
				"flex flex-1 min-w-20 items-center justify-center rounded-md",
				"border-2 border-dashed border-outline text-muted-foreground",
				large ? "min-h-40 text-2xl" : "min-h-20 text-xs md:text-sm"
			) }
		>
			EMPTY
		</div>
	);
}

/**
 * Who is already seated, for a table that has not started yet.
 *
 * Six games rendered the same avatar row in the lobby, and only two of them
 * showed the seats still to fill — which is the one thing somebody looking at a
 * lobby wants to know. Passing `seats` turns that on for all of them.
 *
 * A grid rather than a wrapping flex row, and the reason is sizing rather than
 * looks. A wrapped flex container reports its *max-content* height to whatever
 * is measuring it — the height it would have with every seat on one line — so a
 * parent that sizes to its content, like the dialog this appears in, reserves a
 * single row and the wrapped ones spill out of the bottom. A grid's intrinsic
 * height accounts for the rows it will actually form, so the box fits what is
 * in it.
 *
 * `auto-fit` with a floor keeps the old behaviour at small counts — a table of
 * two shares the width between two seats — while a full table wraps at a width
 * that leaves every seat legible instead of squeezing them onto one line.
 */
export function PlayerLobbyGrid( props: PlayerLobbyGridProps ) {
	const { players, seats, large, className } = props;
	const missing = seats === undefined ? 0 : Math.max( 0, seats - players.length );

	return (
		<div
			className={ cn(
				"grid w-full min-w-0 items-stretch",
				large
					? "gap-4 grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]"
					: "gap-2 grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]",
				className
			) }
		>
			{ players.map( player => (
				<RPlayerInfo key={ player.id } player={ player } large={ large }/>
			) ) }
			{ Array.from( { length: missing }, ( _, index ) => (
				<EmptySeat key={ `empty-${ index }` } large={ large }/>
			) ) }
		</div>
	);
}
