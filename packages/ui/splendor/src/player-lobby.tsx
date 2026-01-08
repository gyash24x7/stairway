import { Avatar, AvatarImage } from "@s2h-ui/primitives/avatar";
import {
	Tooltip,
	TooltipContent,
	TooltipPortal,
	TooltipPositioner,
	TooltipProvider,
	TooltipTrigger
} from "@s2h-ui/primitives/tooltip";
import { cn } from "@s2h-ui/primitives/utils";
import type { Card, Gem, Player } from "@s2h/splendor/types";
import { useStore } from "@tanstack/react-store";
import { DisplayCard } from "./display-card.tsx";
import { handleCardDeSelect, handleCardSelect, store } from "./store.tsx";
import { gemColors } from "./token-picker.tsx";

function DisplayPlayerTokens( props: { player: Player } ) {
	return (
		<div className={ "p-2" }>
			<h2 className={ "pb-1" }>Tokens</h2>
			<div className={ "grid grid-cols-3 gap-1" }>
				{ Object.keys( props.player.tokens ).map( g => g as Gem ).map( gem => (
					<div key={ gem } className={ cn(
						"w-6 h-6 flex justify-center items-center rounded-full border",
						"text-sm text-neutral-dark",
						gemColors[ gem ]
					) }>
						{ props.player.tokens[ gem ] }
					</div>
				) ) }
			</div>
		</div>
	);
}

function DisplayReservedCards( props: { player: Player } ) {
	const selectedCardId = useStore( store, state => state.local.selectedCard );

	const handleReservedClick = ( card?: Card ) => () => {
		if ( !card ) {
			return;
		}

		if ( selectedCardId === card.id ) {
			handleCardDeSelect();
			return;
		}

		handleCardSelect( card.id );
	};

	return (
		<div className={ "flex-1" }>
			<h2 className={ "pb-1" }>Reserved</h2>
			<div className={ "flex gap-1" }>
				{ [ "unused1", "unused2", "unused3" ]
					.map( ( unused, idx ) => [ unused, props.player.reserved[ idx ] ] as ReservedCardPair )
					.map( ( [ unused, card ] ) => (
						<TooltipProvider key={ card?.id ?? unused } delay={ 100 } closeDelay={ 2000 }>
							<Tooltip>
								<TooltipTrigger>
									<div
										className={
											cn(
												"w-10 h-16 p-1 rounded-md border bg-gray-400 transition",
												"hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none",
												card && "cursor-pointer",
												card && selectedCardId === card.id
													? "border-accent ring-2 ring-surface shadow-none"
													: "shadow-shadow"
											)
										}
										onClick={ handleReservedClick( card ) }
									>
										<div className={ cn(
											"flex h-full rounded-md border text-3xl items-center justify-center",
											"bg-background",
											card && gemColors[ card.bonus ]
										) }>
											<h2>{ card?.points }</h2>
										</div>
									</div>
								</TooltipTrigger>
								<TooltipPortal>
									<TooltipPositioner sideOffset={ 10 }>
										{ card && (
											<TooltipContent>
												<DisplayCard card={ card }/>
											</TooltipContent>
										) }
									</TooltipPositioner>
								</TooltipPortal>
							</Tooltip>
						</TooltipProvider>
					) ) }
			</div>
		</div>
	);
}

function DisplayPurchasedCards( props: { player: Player } ) {
	return (
		<div>
			<h2 className={ "pb-1" }>Cards</h2>
			<div className={ "flex gap-1" }>
				{ Object.keys( props.player.tokens ).map( g => g as Gem ).filter( g => g !== "gold" ).map( gem => (
					<div className={ cn( "w-10 h-16 p-1 rounded-md border bg-gray-400" ) } key={ gem }>
						<div className={ cn(
							"flex h-full rounded-md border items-center justify-center",
							"text-3xl text-neutral-dark",
							gemColors[ gem ]
						) }>
							<h2>{ props.player.cards.filter( c => c.bonus === gem ).length }</h2>
						</div>
					</div>
				) ) }
			</div>
		</div>
	);
}

function DisplayPlayerInfoHeader( props: { player: Player } ) {
	return (
		<div className={ "flex justify-between items-center" }>
			<div className={ "flex gap-2 items-center" }>
				<Avatar className={ "rounded-full w-8 h-8 md:w-10 md:h-10 xl:h-12 xl:w-12" }>
					<AvatarImage src={ props.player.avatar } alt={ "" } className={ "bg-accent" }/>
				</Avatar>
				<div className={ "flex flex-col" }>
					<div className={ "text-lg" }>{ props.player.name }</div>
					<div className={ "text-sm" }>
						Tokens: { Object.values( props.player.tokens ).reduce( ( acc, num ) => acc + num ) }
					</div>
				</div>
			</div>
			<div className={ "leading-none -ml-1.5 mb-1 text-4xl" }>
				{ props.player.points }
			</div>
		</div>
	);
}

export function DisplayPlayerInfo( { playerId }: { playerId: string } ) {
	const player = useStore( store, state => state.players[ playerId ] );
	const winner = useStore( store, state => state.winner );
	return (
		<div
			key={ player.id }
			className={ cn(
				"bg-background border-2 rounded-md p-2 flex flex-col gap-1",
				winner === player.id && "border-accent border-4"
			) }
		>
			<DisplayPlayerInfoHeader player={ player }/>
			<DisplayPurchasedCards player={ player }/>
			<div className={ "flex gap-2 items-baseline" }>
				<DisplayReservedCards player={ player }/>
				<DisplayPlayerTokens player={ player }/>
			</div>
		</div>
	);
}

export function PlayerLobby( { mode = "sheet" }: { mode?: "screen" | "sheet" } ) {
	const playerIds = useStore( store, state => state.playerOrder );
	const playerCount = useStore( store, state => state.playerCount );
	const activePlayerId = useStore( store, state => state.playerId );
	const activePlayerIndex = playerIds.indexOf( activePlayerId );
	const orderedPlayerIds = [
		...playerIds.slice( activePlayerIndex ),
		...playerIds.slice( 0, activePlayerIndex )
	];

	return (
		<div className={ cn( "grid grid-cols-1 gap-3", mode === "screen" && playerCount === 4 && "grid-cols-2" ) }>
			{ orderedPlayerIds.map( player => <DisplayPlayerInfo playerId={ player } key={ player }/> ) }
		</div>
	);
}

type ReservedCardPair = readonly [ "unused1" | "unused2" | "unused3", Card | undefined ];