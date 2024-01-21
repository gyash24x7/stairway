import type { Player } from "@literature/types";
import { Combobox, useCombobox } from "@mantine/core";
import type { Dispatch, SetStateAction } from "react";
import { DisplayPlayerMedium } from "./display-player";

export interface SelectPlayerProps {
	options: Player[];
	player?: string;
	setPlayer: Dispatch<SetStateAction<string | undefined>>;
}

export function SelectPlayer( { setPlayer, player, options }: SelectPlayerProps ) {
	const combobox = useCombobox();

	return (
		<Combobox store={ combobox } onOptionSubmit={ setPlayer }>
			<Combobox.Options>
				{ options.map( option => (
					<Combobox.Option value={ option.id } key={ option.id } selected={ player === option.id } p={ 8 }>
						<DisplayPlayerMedium player={ option }/>
					</Combobox.Option>
				) ) }
			</Combobox.Options>
		</Combobox>
	);
}