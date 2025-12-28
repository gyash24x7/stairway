import { Avatar, AvatarImage } from "@s2h-ui/primitives/avatar";
import { Separator } from "@s2h-ui/primitives/separator";
import { cn } from "@s2h-ui/primitives/utils";
import type { Card, Gem } from "@s2h/splendor/types";
import { useStore } from "@tanstack/react-store";
import { gemColors } from "./display-tokens.tsx";
import { store } from "./store.tsx";

export function DisplayPlayerInfo( { playerId }: { playerId: string } ) {
	const player = useStore( store, state => state.players[ playerId ] );

	return (
		<div key={ player.id } className={ "bg-background border-2 rounded-md p-2 flex flex-col gap-2" }>
			<div className={ "flex justify-between items-center" }>
				<div className={ "flex gap-2" }>
					<Avatar className={ "rounded-full w-8 h-8 md:w-10 md:h-10 xl:h-12 xl:w-12" }>
						<AvatarImage src={ player.avatar } alt={ "" } className={ "bg-accent" }/>
					</Avatar>
					<div>
						<h2>{ player.name }</h2>
						<h2>
							Tokens: { Object.values( player.tokens ).reduce( ( acc, num ) => acc + num ) }
						</h2>
					</div>
				</div>
				<div className={ "leading-none -ml-1.5 mb-1 text-4xl" }>
					{ player.points ?? 0 }
				</div>
			</div>
			<Separator/>
			<div className={ "flex gap-2" }>
				<div className={ "flex-1" }>
					<h2 className={ "pb-1" }>Cards</h2>
					<div className={ "flex gap-2" }>
						{ Object.keys( player.tokens )
							.filter( g => g !== "gold" )
							.map( g => g as Gem )
							.map( gem => (
								<div className={ cn( "w-10 h-16 p-1 rounded-md border" ) } key={ gem }>
									<div className={ cn(
										"flex h-full rounded-md border text-3xl items-center justify-center",
										gemColors[ gem ]
									) }>
										<h2>{ player.cards.filter( c => c.bonus === gem ).length }</h2>
									</div>
								</div>
							) ) }
					</div>
				</div>
				<div className={ "p-2" }>
					<h2 className={ "pb-1" }>Tokens</h2>
					<div className={ "grid grid-cols-3 gap-1" }>
						{ Object.keys( player.tokens ).map( g => g as Gem ).map( gem => (
							<div key={ gem } className={ cn(
								"w-6 h-6 flex justify-center items-center rounded-full text-sm",
								"border",
								gemColors[ gem ]
							) }>
								{ player.tokens[ gem ] }
							</div>
						) ) }
					</div>
				</div>
			</div>
			<div className={ "flex gap-2" }>
				<div className={ "flex-1" }>
					<h2 className={ "pb-1" }>Reserved</h2>
					<div className={ "flex gap-2" }>
						{ [ "unused1", "unused2", "unused3" ]
							.map( ( unused, idx ) => [ unused, player.reserved[ idx ] ] as ReservedCardPair )
							.map( ( [ unused, card ] ) => (
								<div
									className={ cn( "w-10 h-16 p-1 rounded-md border bg-gray-400" ) }
									key={ card?.id ?? unused }
								>
									<div className={ cn(
										"flex h-full rounded-md border text-3xl items-center justify-center",
										"bg-background",
										card && gemColors[ card.bonus ]
									) }>
										<h2>{ card?.points }</h2>
									</div>
								</div>
							) ) }
					</div>
				</div>
				<div></div>
			</div>
		</div>
	);
}

export function PlayerLobby() {
	const playerIds = useStore( store, state => state.playerOrder );
	const playerCount = useStore( store, state => state.playerCount );
	return (
		<div
			className={ cn(
				"grid grid-cols-1 gap-3 min-w-sm",
				playerCount === 4 && "grid-cols-2"
			) }
		>
			{ playerIds.map( player => <DisplayPlayerInfo playerId={ player } key={ player }/> ) }
		</div>
	);
}

//01KDB7SYPJ1E8PFQHATWY5VG26
type ReservedCardPair = readonly [ "unused1" | "unused2" | "unused3", Card | undefined ];