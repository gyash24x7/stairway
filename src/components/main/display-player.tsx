import { Avatar, AvatarImage } from "@/components/base/avatar";
import { cn } from "@/utils/cn";

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
				props.withBg && "bg-white border-main border-4"
			) }
			key={ props.player.id }
		>
			<Avatar className={ "rounded-full" }>
				<AvatarImage src={ props.player.avatar } alt={ "" }/>
			</Avatar>
			<div>
				<h2 className={ "font-semibold text-center" }>{ firstName }</h2>
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
