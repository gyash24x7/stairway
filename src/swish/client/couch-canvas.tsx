"use client";

import { MaximizeIcon, MinimizeIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useWindowSize } from "usehooks-ts";

import type { ReactNode } from "react";

import { cn } from "@/shared/ui/utils/cn.ts";
import { usePresentationMode } from "@/swish/client/use-presentation-mode.ts";

export type CouchCanvasProps = {
	width?: number;
	height?: number;
	children: ReactNode;
};

/** The design canvas every couch screen is laid out against. */
export const COUCH_WIDTH = 1920;
export const COUCH_HEIGHT = 1080;

/** How long the fullscreen control lingers before fading out of the way. */
const CONTROL_LINGER_MS = 4000;

/**
 * A fixed design canvas, uniformly scaled to fill the viewport.
 *
 * This is what makes the existing component library usable on a television
 * without threading a `size` prop through `GameCard`/`RCard`/`TokenBar`/… — every
 * component keeps its hard-coded `md:`/`xl:` sizing, lands at its desktop size on
 * the 1920×1080 canvas, and the whole board scales up together on a bigger screen.
 * Aspect ratio is preserved, so a non-16:9 display letterboxes rather than distorts.
 */
export function CouchCanvas( {
	width = COUCH_WIDTH,
	height = COUCH_HEIGHT,
	children
}: CouchCanvasProps ) {
	const { width: viewportWidth, height: viewportHeight } = useWindowSize();
	const scale = Math.min( viewportWidth / width, viewportHeight / height );

	const presentation = usePresentationMode();
	const [ showControl, setShowControl ] = useState( true );

	/**
	 * The couch screen is deliberately free of pointer affordances, so the one
	 * control here shows itself on arrival, fades out, and comes back on any
	 * pointer movement — long enough to click when you walk up with a trackpad,
	 * invisible from the sofa.
	 */
	useEffect( () => {
		if ( !showControl ) {
			return;
		}

		const timer = setTimeout( () => setShowControl( false ), CONTROL_LINGER_MS );
		return () => clearTimeout( timer );
	}, [ showControl ] );

	useEffect( () => {
		const reveal = () => setShowControl( true );
		window.addEventListener( "pointermove", reveal );
		return () => window.removeEventListener( "pointermove", reveal );
	}, [] );

	return (
		<div
			className={ "w-screen h-screen overflow-hidden bg-surface flex items-center justify-center" }
		>
			<div
				className={ "shrink-0 origin-center" }
				style={ { width, height, transform: `scale(${ scale })` } }
			>
				{ children }
			</div>

			{ presentation.supported && (
				// Outside the scaled subtree on purpose: inside it the button would be
				// scaled along with the board and land in the wrong place.
				<button
					type={ "button" }
					aria-label={ presentation.active ? "Exit fullscreen" : "Enter fullscreen" }
					onClick={ presentation.toggle }
					className={ cn(
						"fixed top-4 right-4 z-50 rounded-lg border-2 border-outline",
						"bg-background text-foreground p-2 cursor-pointer",
						"transition-opacity duration-500",
						showControl ? "opacity-70 hover:opacity-100" : "opacity-0"
					) }
				>
					{ presentation.active
						? <MinimizeIcon className={ "w-5 h-5" }/>
						: <MaximizeIcon className={ "w-5 h-5" }/> }
				</button>
			) }
		</div>
	);
}
