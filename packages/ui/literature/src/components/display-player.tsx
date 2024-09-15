import { Avatar, AvatarImage } from "@base/ui";
import type { Player } from "@literature/api";

export const DisplayPlayer = ( { player }: { player: Player } ) => {
	return (
		<div className={ "flex gap-2 px-4 py-2 items-center" } key={ player.id }>
			<Avatar className={ "rounded-full border-2 border-gray-300" }>
				<AvatarImage src={ player.avatar } alt={ "" }/>
			</Avatar>
			<h2 className={ "text-lg" }>{ player.name.toUpperCase() }</h2>
		</div>
	);
};

export const DisplayPlayerVertical = ( { player }: { player: Player } ) => {
	return (
		<div className={ "flex flex-col gap-2 px-4 py-2 items-center" } key={ player.id }>
			<Avatar className={ "rounded-full" }>
				<AvatarImage src={ player.avatar } alt={ "" }/>
			</Avatar>
			<h2>{ player.name.toUpperCase() }</h2>
		</div>
	);
};

export const DisplayPlayerWithCardCount = ( { player, cardCount }: { player: Player, cardCount: number } ) => {
	return (
		<div className={ "flex gap-3 px-4 py-2 items-center flex-1" } key={ player.id }>
			<Avatar className={ "rounded-full border-2 border-gray-300" }>
				<AvatarImage src={ player.avatar } alt={ "" }/>
			</Avatar>
			<div>
				<h2 className={ "text-xl font-bold" }>{ player.name.toUpperCase() }</h2>
				<p className={ "text-sm" }>{ cardCount ?? 0 } Cards</p>
			</div>
		</div>
	);
};