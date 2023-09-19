import type { CardSet } from "@s2h/cards";
import { DisplayCardSet } from "@s2h/ui";
import { Combobox, useCombobox } from "@mantine/core";

export interface SelectCardSetProps {
	cardSet?: CardSet;
	cardSetOptions: CardSet[];
	handleSelection: ( cardSet: string ) => void;
}

export function SelectCardSet( { handleSelection, cardSet, cardSetOptions }: SelectCardSetProps ) {
	const combobox = useCombobox();

	return (
		<Combobox store={ combobox } onOptionSubmit={ handleSelection }>
			<Combobox.Options>
				{ cardSetOptions.map( set => (
					<Combobox.Option value={ set } key={ set } selected={ cardSet === set } p={ 8 }>
						<DisplayCardSet cardSet={ set }/>
					</Combobox.Option>
				) ) }
			</Combobox.Options>
		</Combobox>
	);
}