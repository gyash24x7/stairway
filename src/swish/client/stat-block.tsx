import type { ReactNode } from "react";

import { cn } from "@/shared/ui/utils/cn.ts";

export type StatBlockProps = {
	label: string;
	/** The figure itself, or any node standing in for one (a suit glyph, say). */
	children: ReactNode;
	/** Television sizing — used by the couch screens' header. */
	large?: boolean;
	className?: string;
};

/**
 * One labelled figure in a game's header — deals played, winning points, trump.
 *
 * Every game had its own copy of these eight lines, and they had drifted to
 * alternating `<h1>`/`<h2>` for identical visual weight. The couch screens had a
 * second copy again at television sizes, which is what `large` folds back in.
 */
export function StatBlock( { label, children, large, className }: StatBlockProps ) {
	return (
		<div className={ cn( "py-2 px-4", large && "px-0 py-0", className ) }>
			<p className={ large ? "text-metric-label-lg" : "text-metric-label" }>{ label }</p>
			<p className={ large ? "text-metric-value-lg" : "text-metric-value" }>{ children }</p>
		</div>
	);
}
