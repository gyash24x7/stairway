import { cn } from "@base/components";
import type { Player } from "@literature/store";
import type { Dispatch, SetStateAction } from "react";
import { DisplayPlayer } from "./display-player.tsx";

export type SelectPlayerProps = {
	options: Player[];
	player?: string;
	setPlayer: Dispatch<SetStateAction<string | undefined>>;
}

export function SelectPlayer( { setPlayer, player, options }: SelectPlayerProps ) {

	return (
		<div className={ "flex gap-3 flex-wrap" }>
			{ options.map( ( item ) => (
				<div
					key={ item.id }
					onClick={ () => setPlayer( player === item.id ? undefined : item.id ) }
					className={ cn(
						player === item.id ? "bg-accent" : "bg-background",
						"cursor-pointer border-2 rounded-md flex justify-center flex-1"
					) }
				>
					<DisplayPlayer player={ item }/>
				</div>
			) ) }
		</div>
	);
}