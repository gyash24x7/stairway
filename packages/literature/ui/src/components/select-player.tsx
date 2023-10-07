import type { Dispatch, SetStateAction } from "react";
import { Combobox, useCombobox } from "@mantine/core";
import { PlayerCard } from "./player-card";
import type { Player } from "@literature/data";

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
						<PlayerCard player={ option }/>
					</Combobox.Option>
				) ) }
			</Combobox.Options>
		</Combobox>
	);
}