"use client";

import { cn } from "@base/ui";
import { CardSet } from "@stairway/cards";
import { DisplayCardSet } from "./display-card";

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
					className={ cn( cardSet === item ? "bg-blue-100" : "bg-gray-50", "cursor-pointer" ) }
				>
					<DisplayCardSet cardSet={ item }/>
				</div>
			) ) }
		</div>
	);
}