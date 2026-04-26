import { RDomino } from "@/kingdomino/components/domino";
import type { DominoId, DraftEntry } from "@/kingdomino/core/types";
import type { BasePlayerInfo, PlayerId } from "@/shared/engine/types";
import { cn } from "@/shared/utils/cn";

export type RDraftProps = {
	draft: DraftEntry[];
	active?: boolean;
	players: Record<PlayerId, BasePlayerInfo>;
	onSelect?: ( dominoId: DominoId ) => void;
}

export function RDraft( props: RDraftProps ) {
	return (
		<div
			className={ cn(
				"p-3 rounded-md bg-background flex-1",
				"flex flex-col items-center gap-2 justify-center"
			) }
		>
			{ props.draft.toSorted( ( a, b ) => a.domino.id - b.domino.id ).map( e => {
				const pickedBy = e.selectedBy;
				const avatar = pickedBy ? props.players[ pickedBy ]?.avatar : null;
				const isAvailable = !pickedBy && props.active;

				if ( !e.domino ) {
					return null;
				}

				return (
					<div key={ e.domino.id } className={ "flex items-center gap-2" }>
						<div className={ "flex justify-center items-center w-8 h-8 rounded-full bg-accent" }>
							<span>{ e.domino.id }</span>
						</div>
						<RDomino
							domino={ e.domino }
							enabled={ isAvailable }
							onClick={ isAvailable ? props.onSelect : undefined }
						/>
						{ avatar ? (
							<img
								src={ avatar }
								alt={ pickedBy ? props.players[ pickedBy ].name : "picked player" }
								className={ "w-8 h-8 rounded-full border border-border object-cover" }
							/>
						) : (
							<div className={ "w-8 h-8 rounded-full bg-surface" }/>
						) }
					</div>
				);
			} ) }
		</div>
	);
}
