import type { CardSet } from "@common/cards";
import { HStack, Pressable } from "@gluestack-ui/themed";
import { DisplayCardSet } from "@shared/ui";

export type SelectCardSetProps = {
	cardSet?: CardSet;
	cardSetOptions: CardSet[];
	handleSelection: ( cardSet?: string ) => void;
}

export function SelectCardSet( { cardSetOptions, handleSelection, cardSet }: SelectCardSetProps ) {

	return (
		<HStack gap={ "$3" } flexWrap={ "wrap" }>
			{ cardSetOptions.map( ( item ) => (
				<Pressable
					key={ item }
					onPress={ () => handleSelection( cardSet === item ? undefined : item ) }
					bg={ cardSet === item ? "$blue100" : "$backgroundLight50" }
				>
					<DisplayCardSet cardSet={ item }/>
				</Pressable>
			) ) }
		</HStack>
	);
}