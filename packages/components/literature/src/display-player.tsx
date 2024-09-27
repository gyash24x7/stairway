import { Avatar, AvatarImage, cn } from "@base/components";
import type { Player } from "@stairway/clients/literature";

export type DisplayPlayerProps = {
	player: Player,
	cardCount?: number,
	withBg?: boolean,
	withCardCount?: boolean;
}

export const DisplayPlayer = ( { player, cardCount, withBg, withCardCount }: DisplayPlayerProps ) => {
	const firstName = player.name.split( " " )[ 0 ].toUpperCase();
	return (
		<div
			className={ cn(
				"flex flex-col gap-2 px-4 py-2 items-center w-full rounded-md",
				withBg && "bg-muted"
			) }
			key={ player.id }
		>
			<Avatar className={ "rounded-full" }>
				<AvatarImage src={ player.avatar } alt={ "" }/>
			</Avatar>
			<div>
				<h2 className={ "font-semibold" }>{ firstName }</h2>
				{ withCardCount && <p className={ "text-xs text-center" }>{ cardCount ?? 0 }&nbsp;Cards</p> }
			</div>
		</div>
	);
};
