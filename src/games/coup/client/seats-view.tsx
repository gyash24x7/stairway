"use client";

import { HiddenCard, RCharacterCard } from "@/games/coup/client/character-card.tsx";
import { useCoup } from "@/games/coup/client/context.tsx";
import { Avatar, AvatarImage } from "@/shared/ui/primitives/avatar.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";

import type { PlayerId } from "@/swish/shared/schema.ts";

/**
 * One seat: who it is, what it is holding, and how much of it.
 *
 * Every seat renders through here, the viewer's own included — the only
 * difference is that theirs has characters to show and the rest have counts. So
 * the grid reads as one table rather than as "them, and then you", and a player
 * finds their own cards where they would look for anybody else's.
 */
function Seat( props: { playerId: PlayerId; large?: boolean } ) {
	const { data, playerId, frame } = useCoup();

	const seat = data.view.playerData[ props.playerId ];
	const player = data.players[ props.playerId ];

	if ( !seat || !player ) {
		return null;
	}

	const mine = props.playerId === playerId;
	const out = seat.influenceCount === 0;
	const isTurn = data.context.currentPlayer === props.playerId && !out;

	// Whoever the table is currently waiting on, so a seat reads as thinking
	// rather than the table looking stalled.
	const onTheSpot = !!frame
		&& frame.responders.includes( props.playerId )
		&& !( props.playerId in frame.responses );

	return (
		<div
			className={ cn(
				"flex flex-col gap-2 p-3 rounded-base border-2 bg-background",
				out ? "border-outline/40 opacity-50" : "border-outline",
				isTurn && "ring-4 ring-accent",
				onTheSpot && !isTurn && "ring-2 ring-muted-foreground"
			) }
		>
			<div className={ "flex items-center justify-between gap-3" }>
				<div className={ "flex items-center gap-2 min-w-0" }>
					<Avatar
						className={ cn(
							"rounded-full shrink-0",
							props.large ? "w-12 h-12" : "w-8 h-8"
						) }
					>
						<AvatarImage src={ player.avatar } alt={ "" } className={ "bg-accent" }/>
					</Avatar>
					<span
						className={ cn(
							"font-heading truncate",
							props.large ? "text-2xl" : "text-base",
							out && "line-through",
							mine && "text-accent"
						) }
					>
						{ player.name.toUpperCase() }
					</span>
				</div>
				<span className={ props.large ? "text-metric-value-lg" : "text-metric-value" }>
					{ seat.coins }
				</span>
			</div>

			<div className={ "flex gap-2 flex-wrap" }>
				{ mine
					? data.view.influence.map( ( card, at ) => (
						<RCharacterCard key={ `${ card }-${ at }` } card={ card } large={ props.large }/>
					) )
					: Array.from( { length: seat.influenceCount }, ( _, at ) => (
						<HiddenCard key={ `back-${ at }` } large={ props.large }/>
					) ) }
			</div>

			{ /* Always present, so a seat is the same height whether or not it is
			     being waited on — a grid that reflowed every time somebody was asked
			     a question would be unreadable in a game that asks constantly. */ }
			<span
				className={ cn(
					props.large ? "text-metric-label-lg" : "text-metric-label",
					!onTheSpot && "invisible"
				) }
			>
				{ out ? "OUT" : "THINKING…" }
			</span>
		</div>
	);
}

/**
 * The whole table, in seating order.
 *
 * The viewer's own seat sits where it sits rather than being pulled to the
 * front: the order round the table is information — who acts after whom, who a
 * steal is coming from next — and rearranging it to centre one player would
 * throw that away.
 */
export function SeatsView( props: { large?: boolean } ) {
	const { data } = useCoup();

	return (
		<div
			className={ cn(
				"grid gap-3 w-full",
				props.large ? "grid-cols-2 xl:grid-cols-3" : "grid-cols-1 md:grid-cols-2"
			) }
		>
			{ data.context.players.map(
				id => <Seat key={ id } playerId={ id } large={ props.large }/>
			) }
		</div>
	);
}
