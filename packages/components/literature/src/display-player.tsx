import { Avatar, AvatarImage, cn } from "@base/components";
import type { Player } from "@stairway/clients/literature";

export const DisplayPlayer = ( { player, cardCount }: { player: Player, cardCount?: number } ) => {
	return (
		<div className={ "flex font-semibold gap-2 py-2 px-4 flex-1 lg:flex-none bg-muted items-center rounded-md" }>
			<Avatar className={ "p-1" }>
				<AvatarImage src={ player.avatar } alt={ "" }/>
			</Avatar>
			<div>
				<h2 className={ "font-semibold" }>{ player.name.toUpperCase() }</h2>
				{ !!cardCount && <p className={ "text-xs text-center" }>{ cardCount ?? 0 }&nbsp;Cards</p> }
			</div>
		</div>
	);
};

export const DisplayPlayerVertical = ( { player, cardCount, withBg, withCardCount }: {
	player: Player,
	cardCount?: number,
	withBg?: boolean,
	withCardCount?: boolean;
} ) => {
	return (
		<div
			className={ cn(
				"flex flex-col gap-2 px-4 py-2 items-center flex-1 max-w-xs rounded-md",
				withBg && "bg-muted"
			) }
			key={ player.id }
		>
			<Avatar className={ "rounded-full" }>
				<AvatarImage src={ player.avatar } alt={ "" }/>
			</Avatar>
			<div>
				<h2 className={ "font-semibold" }>{ player.name.toUpperCase() }</h2>
				{ withCardCount && <p className={ "text-xs text-center" }>{ cardCount ?? 0 }&nbsp;Cards</p> }
			</div>
		</div>
	);
};
