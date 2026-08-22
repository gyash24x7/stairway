"use client";

import { useEffect, useRef } from "react";

/** Short double tap: long enough to feel in a pocket, short enough not to nag. */
const TURN_PATTERN = [ 30, 60, 30 ];

/**
 * Buzzes the controller when the turn passes to this seat.
 *
 * Fires only on the `false → true` edge, not while it stays true — the view
 * re-renders on every published update, and a phone that vibrates on each one
 * would be unusable.
 *
 * Feature-detected and silent where unsupported. That notably includes iOS
 * Safari, which does not implement `navigator.vibrate` at all; on iOS the
 * equivalent nudge is the push notification.
 *
 * @param isMyTurn - Whether this seat is the one being waited on.
 */
export function useTurnHaptic( isMyTurn: boolean ) {
	const previous = useRef( isMyTurn );

	useEffect( () => {
		const became = !previous.current && isMyTurn;
		previous.current = isMyTurn;

		if ( !became || typeof navigator === "undefined" || !navigator.vibrate ) {
			return;
		}

		try {
			navigator.vibrate( TURN_PATTERN );
		} catch {
			// Blocked by policy, or a browser that lies about supporting it.
		}
	}, [ isMyTurn ] );
}
