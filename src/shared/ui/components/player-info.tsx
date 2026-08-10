import type { PlayerInfo } from "@/shared/swish/schema.ts";
import { Avatar, AvatarImage } from "@/shared/ui/primitives/avatar.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";

export type PlayerInfoProps = {
	player: PlayerInfo;
	noBg?: boolean;
	/** Television sizing — readable from across a room. Used by the couch screens. */
	large?: boolean;
}

export function RPlayerInfoSmall( props: { player: PlayerInfo } ) {
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
				<h2 className={ "text-center text-xs md:text-sm xl:text-md" }>
					{ firstName }
				</h2>
			</div>
		</div>
	);
}

export function RPlayerInfoStrip( props: { player: PlayerInfo; noAvatar?: boolean; } ) {
	const firstName = props.player.name.split( " " )[ 0 ].toUpperCase();
	return (
		<div className={ "flex gap-1 items-center md:gap-2" } key={ props.player.id }>
			{ !props.noAvatar && (
				<Avatar className={ "rounded-full w-6 h-6 md:w-8 md:h-8 xl:h-10 xl:w-10" }>
					<AvatarImage src={ props.player.avatar } alt={ "" } className={ "bg-background" }/>
				</Avatar>
			) }
			<div>
				<h2 className={ "text-center text-xs md:text-sm xl:text-md" }>
					{ firstName }
				</h2>
			</div>
		</div>
	);
}

export function RPlayerInfo( props: PlayerInfoProps ) {
	const firstName = props.player.name.split( " " )[ 0 ].toUpperCase();
	return (
		<div
			className={ cn(
				"flex flex-col gap-2 flex-1 items-center h-full justify-center",
				"px-2 md:px-4 py-1 md:py-2 rounded-md bg-background",
				props.noBg && "bg-transparent"
			) }
			key={ props.player.id }
		>
			<Avatar
				className={ cn(
					"rounded-full w-8 h-8 md:w-10 md:h-10 xl:h-12 xl:w-12",
					props.large && "w-20 h-20 md:w-24 md:h-24 xl:h-28 xl:w-28"
				) }
			>
				<AvatarImage src={ props.player.avatar } alt={ "" } className={ "bg-accent" }/>
			</Avatar>
			<h2
				className={ cn(
					"text-center",
					!props.large && "text-xs md:text-md xl:text-lg",
					props.large && "text-3xl md:text-4xl xl:text-5xl font-heading"
				) }
			>
				{ firstName }
			</h2>
		</div>
	);
}
