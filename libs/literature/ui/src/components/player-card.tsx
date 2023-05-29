import type { LiteraturePlayer } from "@s2h/literature/utils";
import type { Size } from "@s2h/ui";
import { Avatar, HStack } from "@s2h/ui";

export interface PlayerCardProps {
	player: LiteraturePlayer;
	size?: Size;
}

export function PlayerCard( { player, size = "lg" }: PlayerCardProps ) {
	return (
		<HStack centered spacing={ "sm" }>
			<Avatar src={ player?.avatar } size={ size }/>
			<div>
				<p className={ "text-lg font-semibold" }>{ player.name.toUpperCase() }</p>
				<p className={ "text-base text-dark-200" }>No. of Cards: { player.hand.length }</p>
			</div>
		</HStack>
	);
}