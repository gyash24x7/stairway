import type { BasePlayerInfo } from "@/shared/engine/types";
import { Avatar, AvatarImage } from "@/shared/primitives/avatar";

export type PlayerInfoProps = {
	player: { id: string; name: string; avatar: string; },
	cardCount?: number,
	withBg?: boolean,
	withCardCount?: boolean;
	declaration?: number;
	withDeclaration?: boolean;
}

export function RPlayerInfoSmall( props: { player: BasePlayerInfo } ) {
	const firstName = props.player.name.split( " " )[ 0 ].toUpperCase();
	return (
		<div
			className={ "flex flex-col gap-2 px-4 py-2" }
			key={ props.player.id }
		>
			<Avatar className={ "rounded-full w-6 h-6 md:w-8 md:h-8 xl:h-10 xl:w-10" }>
				<AvatarImage src={ props.player.avatar } alt={ "" } className={ "bg-background" }/>
			</Avatar>
			<div>
				<h2 className={ "text-center text-xs md:text-sm xl:text-md" }>{ firstName }</h2>
			</div>
		</div>
	);
}

export function RPlayerInfo( props: PlayerInfoProps ) {
	const firstName = props.player.name.split( " " )[ 0 ].toUpperCase();
	return (
		<div
			className={ "flex flex-col gap-2 px-4 py-2 items-center flex-1 rounded-md bg-background" }
			key={ props.player.id }
		>
			<Avatar className={ "rounded-full w-8 h-8 md:w-10 md:h-10 xl:h-12 xl:w-12" }>
				<AvatarImage src={ props.player.avatar } alt={ "" } className={ "bg-accent" }/>
			</Avatar>
			<div>
				<h2 className={ "text-center text-xs md:text-md xl:text-xl" }>{ firstName }</h2>
				{ props.withCardCount && (
					<p className={ "text-xs text-center" }>
						{ props.cardCount ?? 0 }&nbsp;Cards
					</p>
				) }
				{ props.withDeclaration && (
					<div className={ "flex w-full justify-center bg-surface py-2" }>
						<h1 className={ "text-lg font-semibold" }>
							{ props.declaration }
						</h1>
					</div>
				) }
			</div>
		</div>
	);
}
