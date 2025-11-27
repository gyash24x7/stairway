import { cn } from "@s2h-ui/primitives/utils";
import { DisplayPlayer } from "@s2h-ui/shared/display-player";
import type { Player } from "@s2h/fish/types";
import type { Dispatch, SetStateAction } from "react";

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
						player === item.id ? "bg-white" : "bg-bg",
						"cursor-pointer border-2 rounded-md flex justify-center flex-1"
					) }
				>
					<DisplayPlayer player={ item }/>
				</div>
			) ) }
		</div>
	);
}