import { useEffect, useRef } from "react";

import type { Pos } from "@/world/map";
import { findPath, isStep, isWalkable } from "@/world/map";
import type { Facing } from "@/world/schema";
import type { WorldConnection } from "@/world/ui/connection";


/** One tile per this many milliseconds. The server accepts steps up to 80ms apart. */
export const STEP_MILLIS = 120;

const KEYS: Record<string, Facing> = {
	ArrowUp: "up",
	ArrowDown: "down",
	ArrowLeft: "left",
	ArrowRight: "right",
	w: "up",
	s: "down",
	a: "left",
	d: "right",
	W: "up",
	S: "down",
	A: "left",
	D: "right"
};

const DELTA: Record<Facing, Pos> = {
	up: { x: 0, y: -1 },
	down: { x: 0, y: 1 },
	left: { x: -1, y: 0 },
	right: { x: 1, y: 0 }
};

const facingOf = ( from: Pos, to: Pos ): Facing =>
	to.x > from.x ? "right" : to.x < from.x ? "left" : to.y > from.y ? "down" : "up";

const isTyping = ( target: EventTarget | null ) =>
	target instanceof HTMLElement
	&& ( target.isContentEditable || [ "INPUT", "TEXTAREA", "SELECT" ].includes( target.tagName ) );

/**
 * Walking: arrow keys or WASD, one tile per `STEP_MILLIS` while a key is held,
 * plus `walkTo` for click-to-walk.
 *
 * If several keys are held, the one pressed last wins. Releasing it hands
 * control back to the one held before, the way most top-down games behave.
 * Pressing a key cancels any click-to-walk path in progress.
 *
 * Disabled while `active` is false, which is when a game is open over the
 * world. Keys typed into a form field never move the avatar.
 */
export function useMovement( connection: WorldConnection | undefined, active: boolean ) {
	const held = useRef<Array<Facing>>( [] );
	const path = useRef<Array<Pos>>( [] );
	/** Where the current click-to-walk is heading, so it can be re-planned after a correction. */
	const goal = useRef<Pos | undefined>( undefined );
	const lastStepAt = useRef( 0 );

	useEffect( () => {
		if ( !connection || !active ) {
			held.current = [];
			path.current = [];
			return;
		}

		const tryStep = () => {
			const self = connection.getState().self;
			if ( !self || performance.now() - lastStepAt.current < STEP_MILLIS ) {
				return;
			}

			const direction = held.current.at( -1 );
			if ( direction ) {
				path.current = [];
				goal.current = undefined;
				const delta = DELTA[ direction ];
				const next = { x: self.pos.x + delta.x, y: self.pos.y + delta.y };
				if ( isWalkable( next ) && connection.step( next, direction ) ) {
					lastStepAt.current = performance.now();
				}
				return;
			}

			let next = path.current[ 0 ];
			if ( next && !isStep( self.pos, next ) && goal.current ) {
				// A correction moved us off the path. Plan again from where the
				// server says we are, rather than abandoning the walk.
				path.current = findPath( self.pos, goal.current );
				next = path.current[ 0 ];
			}
			if ( next && isWalkable( next ) && connection.step( next, facingOf( self.pos, next ) ) ) {
				path.current.shift();
				lastStepAt.current = performance.now();
			}
		};

		const onKeyDown = ( event: KeyboardEvent ) => {
			const direction = KEYS[ event.key ];
			if ( !direction || isTyping( event.target ) || event.metaKey || event.ctrlKey ) {
				return;
			}
			event.preventDefault();
			if ( !held.current.includes( direction ) ) {
				held.current = [ ...held.current, direction ];
				tryStep();
			}
		};

		const onKeyUp = ( event: KeyboardEvent ) => {
			const direction = KEYS[ event.key ];
			if ( direction ) {
				held.current = held.current.filter( d => d !== direction );
			}
		};

		// Without this, a key held while the window loses focus would keep walking forever.
		const onBlur = () => {
			held.current = [];
		};

		const timer = setInterval( tryStep, 30 );
		window.addEventListener( "keydown", onKeyDown );
		window.addEventListener( "keyup", onKeyUp );
		window.addEventListener( "blur", onBlur );
		return () => {
			clearInterval( timer );
			window.removeEventListener( "keydown", onKeyDown );
			window.removeEventListener( "keyup", onKeyUp );
			window.removeEventListener( "blur", onBlur );
		};
	}, [ connection, active ] );

	/**
	 * Walks to `target` along the shortest path. If `target` is a table or
	 * plant, walks to the nearest tile beside it instead, so clicking a table is
	 * a way to go and sit at it.
	 */
	const walkTo = ( target: Pos ) => {
		const self = connection?.getState().self;
		if ( !self || !active ) {
			return;
		}
		const goals = isWalkable( target )
			? [ target ]
			: Object.values( DELTA ).map( d => ( { x: target.x + d.x, y: target.y + d.y } ) );
		const paths = goals.map( goal => findPath( self.pos, goal ) ).filter( p => p.length > 0 );
		path.current = paths.sort( ( a, b ) => a.length - b.length )[ 0 ] ?? [];
		goal.current = path.current.at( -1 );
	};

	return { walkTo };
}
