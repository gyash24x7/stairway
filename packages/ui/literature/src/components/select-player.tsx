import type { Player } from "@backend/literature";
import { HStack, Pressable } from "@gluestack-ui/themed";
import type { Dispatch, SetStateAction } from "react";
import { DisplayPlayer } from "./display-player";

export type SelectPlayerProps = {
	options: Player[];
	player?: string;
	setPlayer: Dispatch<SetStateAction<string | undefined>>;
}

export function SelectPlayer( { setPlayer, player, options }: SelectPlayerProps ) {

	return (
		<HStack gap={ "$3" } flexWrap={ "wrap" }>
			{ options.map( ( item ) => (
				<Pressable
					key={ item.id }
					onPress={ () => setPlayer( player === item.id ? undefined : item.id ) }
					bg={ player === item.id ? "$blue100" : "$backgroundLight50" }
					borderRadius={ 2 }
				>
					<DisplayPlayer player={ item }/>
				</Pressable>
			) ) }
		</HStack>
	);
}