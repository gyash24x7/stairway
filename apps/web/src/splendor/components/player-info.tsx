"use client";

import { CounterTween } from "@/shared/animations/counter-tween";
import { FloatPlusN } from "@/shared/animations/float-plus-n";
import { Avatar, AvatarImage } from "@/shared/primitives/avatar";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@/shared/primitives/drawer";
import { RadioSelect } from "@/shared/primitives/radio-select";
import { cn } from "@s2h/shared/utils/cn";
import { useSplendor } from "@/splendor/components/context";
import { GameCard } from "@/splendor/components/game-card";
import { PurchaseCard } from "@/splendor/components/purchase-card";
import { gemColors, gemLightColors } from "@/splendor/components/utils";
import type { Gem } from "@s2h/splendor-core/types";
import { GEMS_WITH_GOLD } from "@s2h/splendor-core/utils";
import { motion } from "framer-motion";
import { useState } from "react";

function PlayerTokenCount( props: { gem: Gem; playerId: string } ) {
	const { shared } = useSplendor();
	const count = shared.state.playerData[ props.playerId ].tokens[ props.gem ];

	return (
		<motion.div
			animate={ { scale: [ 1, 1.15, 1 ] } }
			transition={ { duration: 0.4 } }
			key={ count }
			className={ cn(
				"w-6 h-6 flex justify-center items-center rounded-full",
				"border border-dotted border-inverted-surface",
				"text-sm text-center text-neutral-dark",
				gemColors[ props.gem ]
			) }
		>
			{ count }
		</motion.div>
	);
}

function ReservedCards( props: { playerId: string } ) {
	const { shared, player } = useSplendor();
	const playerData = shared.state.playerData[ props.playerId ];
	const playerName = shared.players[ props.playerId ].name.toUpperCase();
	const reserved = playerData?.reserved ?? [];

	const [ open, setOpen ] = useState( false );
	const [ selectedCardId, setSelectedCardId ] = useState<string>();

	const selectedCard = reserved.find( c => c.id === selectedCardId );

	const isOwnCards = props.playerId === player.playerId;
	const isMyTurn = shared.status === "IN_PROGRESS"
		&& shared.context.currentPlayer === player.playerId;

	const canSelect = isOwnCards && isMyTurn;

	const discounts = shared.state.playerData[ player.playerId ].cards;
	const tokens = shared.state.playerData[ player.playerId ].tokens;

	const handleOpenChange = ( isOpen: boolean ) => {
		setOpen( isOpen );
		if ( !isOpen ) {
			setSelectedCardId( undefined );
		}
	};

	return (
		<Drawer open={ open } onOpenChange={ handleOpenChange }>
			<div
				className={ cn(
					"w-8 h-12 p-1 cursor-pointer",
					"flex rounded-md items-center justify-center",
					"border-2 border-inverted-surface",
					"text-2xl text-neutral-dark",
					gemLightColors[ "gold" ]
				) }
				onClick={ () => reserved.length > 0 && setOpen( true ) }
			>
				<h2>{ reserved.length }</h2>
			</div>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>
						{ isOwnCards && <span>MY&nbsp;</span> }
						<span>RESERVED CARDS</span>
						{ !isOwnCards && <span>&nbsp;FOR { playerName }</span> }
					</DrawerTitle>
					<DrawerDescription>
						{ canSelect && <span>Select Card to Purchase</span> }
					</DrawerDescription>
				</DrawerHeader>
				<div className={ "px-4" }>
					<RadioSelect
						options={ reserved.map( c => c.id ) }
						value={ selectedCardId }
						onChange={ setSelectedCardId }
						isDisabled={ () => !canSelect }
						className={ "justify-center" }
						renderOption={ ( cardId ) => {
							const card = reserved.find( c => c.id === cardId )!;
							return <GameCard card={ card }/>;
						} }
					/>
				</div>
				<DrawerFooter>
					{ canSelect && selectedCard && (
						<PurchaseCard
							gameId={ shared.id }
							card={ selectedCard }
							tokens={ tokens }
							discounts={ discounts }
						/>
					) }
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}

function PurchasedCards( props: { gem: Exclude<Gem, "gold">; playerId: string; } ) {
	const { shared } = useSplendor();
	const cards = shared.state.playerData[ props.playerId ].cards;
	const count = cards.filter( c => c.bonus === props.gem ).length;
	return (
		<motion.div
			animate={ { scale: [ 1, 1.2, 1 ] } }
			transition={ { duration: 0.45 } }
			key={ count }
			className={ cn(
				"w-8 h-12 p-1",
				"flex rounded-md items-center justify-center",
				"border-2 border-inverted-surface",
				"text-2xl text-neutral-dark",
				gemLightColors[ props.gem ]
			) }
		>
			<h2>{ count }</h2>
		</motion.div>
	);
}

function PlayerGemInfo( props: { playerId: string } ) {
	return (
		<div className={ cn( "flex justify-around gap-2 flex-1 p-2" ) }>
			{ GEMS_WITH_GOLD.map( gem => (
				<div key={ gem } className={ "flex flex-col gap-1 items-center justify-center" }>
					{ gem !== "gold" && <PurchasedCards playerId={ props.playerId } gem={ gem }/> }
					{ gem === "gold" && <ReservedCards playerId={ props.playerId }/> }
					<PlayerTokenCount gem={ gem } playerId={ props.playerId }/>
				</div>
			) ) }
		</div>
	);
}

export function PlayerInfo( { playerId, bg }: { playerId: string; bg?: boolean; } ) {
	const { shared } = useSplendor();
	const baseInfo = shared.players[ playerId ];
	const gameInfo = shared.state.playerData[ playerId ];
	const isCurrentTurn = shared.status === "IN_PROGRESS"
		&& shared.context.currentPlayer === playerId;

	return (
		<motion.div
			layout
			className={ cn(
				"bg-background rounded-md overflow-hidden relative",
				bg && "bg-accent/20"
			) }
			animate={ isCurrentTurn
				? {
					boxShadow: [
						"0 0 0 0 rgba(0,0,0,0)",
						"0 0 0 4px var(--color-accent)",
						"0 0 0 0 rgba(0,0,0,0)"
					]
				}
				: { boxShadow: "0 0 0 0 rgba(0,0,0,0)" }
			}
			transition={ isCurrentTurn
				? { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
				: { duration: 0.3 }
			}
		>
			<div className={ "flex gap-2 justify-between" }>
				<div className={ "flex sm:flex-col gap-2 items-center p-2 min-w-30" }>
					<Avatar className={ "rounded-full w-8 h-8 md:w-10 md:h-10 xl:h-12 xl:w-12" }>
						<AvatarImage src={ baseInfo.avatar } alt={ "" } className={ "bg-accent" }/>
					</Avatar>
					<div className={ "flex flex-col text-center text-sm md:text-lg" }>
						{ baseInfo.name?.split( " " )[ 0 ] }
					</div>
				</div>
				<div className={ "hidden sm:flex flex-1" }>
					<PlayerGemInfo playerId={ playerId }/>
				</div>
				<div
					className={ cn(
						"flex items-center justify-center bg-accent relative",
						"rounded-r-md w-16 md:w-20 shrink-0"
					) }
				>
					<div className={ "text-4xl font-heading text-neutral-dark text-center" }>
						<CounterTween value={ gameInfo.points }/>
					</div>
					<FloatPlusN value={ gameInfo.points } className={ "text-base md:text-lg" }/>
				</div>
			</div>
			<div className={ "block sm:hidden" }>
				<PlayerGemInfo playerId={ playerId }/>
			</div>
		</motion.div>
	);
}
