"use client";

import type { ReactNode } from "react";
import { useWindowSize } from "usehooks-ts";

export type CouchCanvasProps = {
	width?: number;
	height?: number;
	children: ReactNode;
};

/** The design canvas every couch screen is laid out against. */
export const COUCH_WIDTH = 1920;
export const COUCH_HEIGHT = 1080;

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
		</div>
	);
}
