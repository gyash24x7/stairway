"use client";

import { useState } from "react";

import { HiddenCard, RCharacterCard } from "@/games/coup/client/character-card.tsx";
import { useCoup } from "@/games/coup/client/context.tsx";
import {
	COUP_BLOCK_ACTION,
	COUP_CHALLENGE_ACTION,
	COUP_CHALLENGE_BLOCK,
	COUP_EXCHANGE,
	COUP_LOSE_INFLUENCE
} from "@/games/coup/shared/schema.ts";
import { blockersFor } from "@/games/coup/shared/utils.ts";
import { Button } from "@/shared/ui/primitives/button.tsx";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@/shared/ui/primitives/drawer.tsx";
import { TurnTimer } from "@/swish/client/turn-timer.tsx";

import type { CharacterCard } from "@/games/coup/shared/schema.ts";
import type { PlayerId } from "@/swish/shared/schema.ts";

/** What the action reads as in a sentence about somebody doing it. */
const PHRASING: Record<string, string> = {
	income: "take income",
	foreignAid: "take foreign aid",
	coup: "launch a coup",
	tax: "tax as the Duke",
	assassinate: "assassinate",
	steal: "steal",
	exchange: "exchange as the Ambassador"
};

/**
 * Every window a seat can be asked to answer, in one component.
 *
 * All five are opened by the *engine* rather than by the player, so the drawer
 * is `open` and not dismissible: there is nothing to close, only something to
 * answer. The frame's own deadline drives the timer, and letting it run out is a
 * legitimate answer for the two reaction windows — silence is a pass.
 */
export function ReactionPrompt() {
	const {
		data,
		playerId,
		awaiting,
		frame,
		challenge,
		block,
		surrenderInfluence,
		exchangeCards,
		isPending
	} = useCoup();

	const [ keeping, setKeeping ] = useState<Array<number>>( [] );

	if ( !awaiting || !playerId ) {
		return null;
	}

	const pending = data.view.pending;
	const hand = data.view.influence;
	const who = ( id: PlayerId | undefined ) =>
		( id ? data.players[ id ]?.name ?? "someone" : "someone" );

	const shell = ( title: string, description: string, body: React.ReactNode ) => (
		<Drawer open dismissible={ false }>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>{ title }</DrawerTitle>
					<DrawerDescription>{ description }</DrawerDescription>
				</DrawerHeader>
				{ frame?.deadline !== undefined && (
					<div className={ "px-4 pb-2 flex justify-center" }>
						<TurnTimer deadline={ frame.deadline }/>
					</div>
				) }
				{ body }
			</DrawerContent>
		</Drawer>
	);

	if ( awaiting === COUP_CHALLENGE_ACTION && pending?.claim ) {
		return shell(
			`CHALLENGE THE ${ pending.claim.toUpperCase() }?`,
			`${ who( pending.actor ) } claims the ${ pending.claim } to `
			+ `${ PHRASING[ pending.action ] ?? pending.action }. `
			+ "Call it and you lose an influence if they have it.",
			<DrawerFooter className={ "flex-row gap-3" }>
				<Button
					className={ "flex-1" }
					disabled={ isPending }
					onClick={ () => challenge( { challenge: true } ) }
				>
					CHALLENGE
				</Button>
				<Button
					className={ "flex-1" }
					variant={ "neutral" }
					disabled={ isPending }
					onClick={ () => challenge( { challenge: false } ) }
				>
					ALLOW
				</Button>
			</DrawerFooter>
		);
	}

	if ( awaiting === COUP_CHALLENGE_BLOCK && pending?.block ) {
		return shell(
			`CHALLENGE THE ${ pending.block.card.toUpperCase() }?`,
			`${ who( pending.block.by ) } claims the ${ pending.block.card } to stop `
			+ `${ who( pending.actor ) }. Call it and you lose an influence if they have it.`,
			<DrawerFooter className={ "flex-row gap-3" }>
				<Button
					className={ "flex-1" }
					disabled={ isPending }
					onClick={ () => challenge( { challenge: true } ) }
				>
					CHALLENGE
				</Button>
				<Button
					className={ "flex-1" }
					variant={ "neutral" }
					disabled={ isPending }
					onClick={ () => challenge( { challenge: false } ) }
				>
					ALLOW
				</Button>
			</DrawerFooter>
		);
	}

	if ( awaiting === COUP_BLOCK_ACTION && pending ) {
		// Every character that stops this action is offered, held or not: claiming
		// one you do not have is a legitimate move, and the UI does not get to
		// decide that for you.
		const options = blockersFor( pending.action );

		return shell(
			"BLOCK IT?",
			`${ who( pending.actor ) } is trying to `
			+ `${ PHRASING[ pending.action ] ?? pending.action }`
			+ `${ pending.target ? ` from ${ who( pending.target ) }` : "" }.`,
			<>
				<div className={ "px-4 flex gap-3 flex-wrap justify-center" }>
					{ options.map( card => (
						<RCharacterCard
							key={ card }
							card={ card }
							disabled={ isPending }
							onClick={ () => block( { block: card } ) }
						/>
					) ) }
				</div>
				<DrawerFooter>
					<Button
						variant={ "neutral" }
						disabled={ isPending }
						onClick={ () => block( { block: null } ) }
					>
						ALLOW IT
					</Button>
				</DrawerFooter>
			</>
		);
	}

	if ( awaiting === COUP_LOSE_INFLUENCE ) {
		return shell(
			"GIVE UP AN INFLUENCE",
			hand.length > 1
				? "Choose which card to give up. It is shown to the table and then shuffled "
				+ "back into the deck."
				: "This is your last card. Turning it over puts you out.",
			<div className={ "px-4 pb-4 flex gap-3 flex-wrap justify-center" }>
				{ hand.map( ( card, at ) => (
					<RCharacterCard
						key={ `${ card }-${ at }` }
						card={ card }
						disabled={ isPending }
						onClick={ () => surrenderInfluence( { card } ) }
					/>
				) ) }
			</div>
		);
	}

	if ( awaiting === COUP_EXCHANGE ) {
		// The pool is the seat's own cards plus what it drew, and it keeps as many
		// as it came in with. Indices rather than names, since the pool can hold
		// two of the same character and they are not interchangeable to click.
		const pool = [ ...hand, ...( data.view.exchangeDraw ?? [] ) ];
		const keepCount = hand.length;

		const toggle = ( at: number ) => setKeeping( current => current.includes( at )
			? current.filter( index => index !== at )
			: current.length < keepCount ? [ ...current, at ] : current );

		return shell(
			"CHOOSE WHAT TO KEEP",
			`Keep ${ keepCount }. The rest goes back into the deck.`,
			<>
				<div className={ "px-4 flex gap-3 flex-wrap justify-center" }>
					{ pool.map( ( card, at ) => (
						<RCharacterCard
							key={ `${ card }-${ at }` }
							card={ card }
							selected={ keeping.includes( at ) }
							disabled={ isPending }
							onClick={ () => toggle( at ) }
						/>
					) ) }
				</div>
				<DrawerFooter>
					<Button
						disabled={ isPending || keeping.length !== keepCount }
						onClick={ () => exchangeCards( {
							keep: keeping.map( at => pool[ at ]! ) as Array<CharacterCard>
						} ) }
					>
						{ keeping.length === keepCount
							? "KEEP THESE"
							: `CHOOSE ${ keepCount - keeping.length } MORE` }
					</Button>
				</DrawerFooter>
			</>
		);
	}

	// A window this seat is in but that has no prompt of its own. Nothing to show
	// beyond the fact that the table is waiting.
	return shell(
		"WAITING",
		"The table is settling something.",
		<div className={ "px-4 pb-4 flex justify-center" }><HiddenCard/></div>
	);
}
