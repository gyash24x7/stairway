"use client";

import { useLayoutEffect, useRef, useState } from "react";

import type { ReactNode } from "react";

import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";

export type ActionBarProps = {
	/** The controls this seat can use right now. */
	children?: ReactNode;
	/**
	 * Whether to offer the controls at all. False swaps in the waiting state,
	 * which is what a phone shows while the table is on someone else.
	 */
	showActions?: boolean;
	/** Who the table is waiting on, shown alongside the spinner. */
	waitingFor?: string;
	/**
	 * Controls that stay available whether or not it is this seat's turn — handing
	 * the seat to a bot is the case that matters, since a seat wanting out is
	 * usually a seat that is *not* being waited on.
	 */
	persistentActions?: ReactNode;
	className?: string;
	/** Widens the action row past its `max-w-lg` default — wordle's keyboard needs it. */
	contentClassName?: string;
};

/**
 * The sticky bar every playing surface puts its controls in.
 *
 * It measures itself and renders a spacer of the same height in the flow, so a
 * page never has to guess a bottom margin for it. That guess was previously
 * hand-tuned per game — `mb-32` through `mb-80` — against a height that is
 * actually decided by the bar's own contents, and so was wrong for some of them
 * at any given breakpoint.
 *
 * Mount it as the last child of the page's column; the spacer takes the place
 * the fixed bar vacated.
 */
export function ActionBar( props: ActionBarProps ) {
	const { children, showActions = true, waitingFor, className, contentClassName } = props;
	const { persistentActions } = props;
	const barRef = useRef<HTMLDivElement>( null );
	const [ height, setHeight ] = useState( 0 );

	useLayoutEffect( () => {
		const node = barRef.current;
		if ( !node ) {
			return;
		}

		// `offsetHeight`, not `contentRect`: the latter is the *content* box and
		// leaves out this bar's vertical padding, so the spacer came up short by
		// exactly that much and clipped whatever the page ended with.
		const observer = new ResizeObserver( () => setHeight( node.offsetHeight ) );

		observer.observe( node );
		setHeight( node.offsetHeight );
		return () => observer.disconnect();
	}, [] );

	return (
		<>
			<div aria-hidden style={ { height } } className={ "shrink-0 w-full" }/>
			<div
				ref={ barRef }
				className={ cn(
					"fixed left-0 right-0 bottom-0 bg-surface z-10",
					"rounded-t-xl flex flex-col gap-2 px-3 py-5 items-center",
					className
				) }
			>
				{ showActions
					? (
						<div
							className={ cn(
								"flex gap-3 flex-wrap justify-center w-full max-w-lg",
								contentClassName
							) }
						>
							{ children }
						</div>
					)
					: (
						<div className={ "flex gap-3 items-center text-muted-foreground" }>
							<Spinner/>
							<span className={ "font-heading" }>
								{ waitingFor ? `WAITING FOR ${ waitingFor.toUpperCase() }` : "WAITING" }
							</span>
						</div>
					) }
				{ !!persistentActions && (
					<div className={ "flex gap-3 flex-wrap justify-center w-full max-w-lg" }>
						{ persistentActions }
					</div>
				) }
			</div>
		</>
	);
}
