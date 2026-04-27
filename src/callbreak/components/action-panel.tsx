"use client";

import { useCallbreak } from "@/callbreak/components/context";
import { DeclareWins } from "@/callbreak/components/declare-wins";
import { PlayCard } from "@/callbreak/components/play-card";
import { cn } from "@/shared/utils/cn";

export function ActionPanel() {
	const { isMyTurn, shared } = useCallbreak();
	const phase = shared.context.phase;

	return (
		<div
			className={ cn(
				"fixed left-0 right-0 bottom-0 bg-surface z-10",
				"rounded-t-xl flex flex-col gap-2 px-3 py-5 items-center"
			) }
		>
			<div className={ "flex gap-3 flex-wrap justify-center w-full max-w-lg" }>
				{ phase === "DECLARING" && isMyTurn && <DeclareWins/> }
				{ phase === "PLAYING" && isMyTurn && <PlayCard/> }
			</div>
		</div>
	);
}
