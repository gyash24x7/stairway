import { Avatar, AvatarImage } from "@s2h-ui/primitives/avatar";
import { cn } from "@s2h-ui/primitives/utils";

export type DisplayPlayerProps = {
	player: { id: string; name: string; avatar: string; },
	cardCount?: number,
	withBg?: boolean,
	withCardCount?: boolean;
	declaration?: number;
	withDeclaration?: boolean;
}

export function DisplayPlayer( props: DisplayPlayerProps ) {
	const firstName = props.player.name.split( " " )[ 0 ].toUpperCase();
	return (
		<div
			className={ cn(
				"flex flex-col gap-2 px-4 py-2 items-center w-full rounded-md",
				props.withBg && "bg-white border-components border-4"
			) }
			key={ props.player.id }
		>
			<Avatar className={ "rounded-full w-8 h-8 md:w-10 md:h-10 xl:h-12 xl:w-12" }>
				<AvatarImage src={ props.player.avatar } alt={ "" }/>
			</Avatar>
			<div>
				<h2 className={ "text-center text-xs md:text-md xl:text-xl" }>{ firstName }</h2>
				{ props.withCardCount && (
					<p className={ "text-xs text-center" }>
						{ props.cardCount ?? 0 }&nbsp;Cards
					</p>
				) }
				{ props.withDeclaration && (
					<div className={ "flex w-full justify-center bg-muted py-2" }>
						<h1 className={ "text-lg font-semibold" }>
							{ props.declaration }
						</h1>
					</div>
				) }
			</div>
		</div>
	);
}
