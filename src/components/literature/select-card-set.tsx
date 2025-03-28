"use client";

import { DisplayCardSet } from "@/components/main/display-card";
import type { CardSet } from "@/libs/cards/types";
import { cn } from "@/utils/cn";

export type SelectCardSetProps = {
	cardSet?: CardSet;
	cardSetOptions: CardSet[];
	handleSelection: ( cardSet?: string ) => void;
}

export function SelectCardSet( { cardSetOptions, handleSelection, cardSet }: SelectCardSetProps ) {
	return (
		<div className={ "flex gap-3 flex-wrap" }>
			{ cardSetOptions.map( ( item ) => (
				<div
					key={ item }
					onClick={ () => handleSelection( cardSet === item ? undefined : item ) }
					className={ cn(
						cardSet === item ? "bg-white" : "bg-bg",
						"cursor-pointer flex-1 rounded-md border-2 px-4 py-2 flex justify-center"
					) }
				>
					<DisplayCardSet cardSet={ item }/>
				</div>
			) ) }
		</div>
	);
}