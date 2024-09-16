"use client";

import { cn } from "@base/ui";
import type { Player } from "@literature/api";
import type { Dispatch, SetStateAction } from "react";
import { DisplayPlayer } from "./display-player";

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
						player === item.id ? "bg-blue-100" : "bg-gray-50",
						"cursor-pointer border-2 rounded-md"
					) }
				>
					<DisplayPlayer player={ item }/>
				</div>
			) ) }
		</div>
	);
}