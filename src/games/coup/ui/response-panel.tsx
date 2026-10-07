import { cn } from "cn";
import type { ReactNode } from "react";
import { useState } from "react";

import type { CoupCard, CoupView, StealBlocker } from "@/games/coup/schema";
import { CoupCardTile } from "@/games/coup/ui/card";
import { Button } from "@/shared/primitives/button";
import type { InteractionFrame, PlayerId, Roster } from "@/swish/schema";
import { TurnTimer } from "@/swish/ui/turn-timer";
import { optionsFor } from "@/swish/utils";


/** What each objection is called on the button that makes it. */
const RESPONSE_LABEL = {
	challenge: "CHALLENGE",
	blockForeignAid: "BLOCK — CLAIM DUKE",
	blockAssassination: "BLOCK — CLAIM CONTESSA",
	blockSteal: "BLOCK — CLAIM CAPTAIN OR AMBASSADOR"
} as const;

/** The two characters that can stop a steal, in the order the drawer offers them. */
const STEAL_BLOCKERS: ReadonlyArray<StealBlocker> = [ "CAPTAIN", "AMBASSADOR" ];

export type CoupResponsePanelProps = {
	readonly frame: InteractionFrame;
	readonly view: CoupView;
	readonly players: Roster;
	readonly me: PlayerId;
	/** When this window closes, from the `GameView` envelope. */
	readonly deadline?: number;
	readonly disabled?: boolean;
	readonly onChallenge: () => void;
	readonly onBlockForeignAid: () => void;
	readonly onBlockAssassination: () => void;
	readonly onBlockSteal: ( claim: StealBlocker ) => void;
	readonly onReveal: ( card: CoupCard ) => void;
	readonly onExchangeReturn: ( cards: ReadonlyArray<CoupCard> ) => void;
	readonly onPass: () => void;
};

/**
 * The open window, and this seat's answer to it.
 *
 * Every window in Coup is one of three questions, and they are not the same
 * question at all: *do you object to this* (optional, a race, and the only one
 * anybody else is also being asked), *which influence do you give up* (mandatory,
 * yours alone), and *which cards do you keep* (mandatory, yours alone). They get
 * three layouts rather than one list of buttons, because a mandatory decision
 * offered next to a PASS button reads as declinable when it is not.
 *
 * A seat not being waited on still sees the window — who is being asked and how
 * long they have — because watching the table think is most of Coup, and a
 * screen that went blank between your own turns would hide the game being played.
 */
export function CoupResponsePanel( props: CoupResponsePanelProps ) {
	const { frame, view, players, me, deadline, disabled } = props;

	const [ blockOpen, setBlockOpen ] = useState( false );
	const [ keep, setKeep ] = useState<ReadonlyArray<number>>( [] );

	const options = optionsFor( frame, me );
	const waitingOnMe = frame.pending.includes( me );

	const waitingNames = frame.pending
		.map( id => players[ id ]?.name.split( " " )[ 0 ]?.toUpperCase() )
		.filter( name => !!name );

	const header = (
		<div className={ "flex items-center justify-center gap-3" }>
			<p className={ "text-status" }>
				{ waitingOnMe
					? "YOU'RE BEING ASKED"
					: `WAITING ON ${ waitingNames.join( ", " ) || "THE TABLE" }` }
			</p>
			<TurnTimer deadline={ deadline }/>
		</div>
	);

	const shell = ( children: ReactNode ) => (
		<div
			className={ cn(
				"flex w-full flex-col items-center gap-3 rounded-md border-2 p-3",
				waitingOnMe ? "border-accent bg-accent/10" : "border-outline bg-background"
			) }
		>
			{ header }
			{ children }
		</div>
	);

	if ( !waitingOnMe ) {
		return shell(
			<p className={ "text-xs text-muted-foreground" }>
				{ "Nothing to answer — this one isn't yours." }
			</p>
		);
	}

	// --- Give up an influence ------------------------------------------------

	if ( options.includes( "reveal" ) ) {
		return shell(
			<>
				<p className={ "text-sm text-muted-foreground" }>
					{ "Choose an influence to give up. It goes back into the deck — nobody else sees which." }
				</p>
				<div className={ "flex flex-wrap justify-center gap-2" }>
					{ view.hand.map( ( card, index ) => (
						<CoupCardTile
							key={ `lose-${ index }-${ card }` }
							card={ card }
							disabled={ disabled }
							onClick={ () => props.onReveal( card ) }
						/>
					) ) }
				</div>
			</>
		);
	}

	// --- Settle an exchange --------------------------------------------------

	if ( options.includes( "exchangeReturn" ) ) {
		// Indices rather than cards: a pool can hold two Dukes, and "keep the Duke"
		// has to mean one particular one of them or the count comes out wrong.
		const pool = [ ...view.hand, ...view.drawn ];
		const need = view.hand.length;
		const toggle = ( index: number ) => setKeep( current => current.includes( index )
			? current.filter( kept => kept !== index )
			: current.length < need ? [ ...current, index ] : current );

		return shell(
			<>
				<p className={ "text-sm text-muted-foreground" }>
					{ `Keep exactly ${ need } — the rest go back into the deck.` }
				</p>
				<div className={ "flex flex-wrap justify-center gap-2" }>
					{ pool.map( ( card, index ) => (
						<CoupCardTile
							key={ `pool-${ index }-${ card }` }
							card={ card }
							selected={ keep.includes( index ) }
							disabled={ disabled }
							onClick={ () => toggle( index ) }
						/>
					) ) }
				</div>
				<Button
					disabled={ disabled || keep.length !== need }
					onClick={ () => {
						props.onExchangeReturn( keep.flatMap( index => {
							const card = pool[ index ];
							return card ? [ card ] : [];
						} ) );
						setKeep( [] );
					} }
				>
					{ `KEEP ${ keep.length }/${ need }` }
				</Button>
			</>
		);
	}

	// --- Object, or let it stand ---------------------------------------------

	const onBlockSteal = ( claim: StealBlocker ) => {
		setBlockOpen( false );
		props.onBlockSteal( claim );
	};

	return shell(
		<>
			<div className={ "flex flex-wrap justify-center gap-2" }>
				{ options.includes( "challenge" ) && (
					<Button disabled={ disabled } onClick={ props.onChallenge }>
						{ RESPONSE_LABEL.challenge }
					</Button>
				) }
				{ options.includes( "blockForeignAid" ) && (
					<Button disabled={ disabled } onClick={ props.onBlockForeignAid }>
						{ RESPONSE_LABEL.blockForeignAid }
					</Button>
				) }
				{ options.includes( "blockAssassination" ) && (
					<Button disabled={ disabled } onClick={ props.onBlockAssassination }>
						{ RESPONSE_LABEL.blockAssassination }
					</Button>
				) }
				{ options.includes( "blockSteal" ) && !blockOpen && (
					<Button disabled={ disabled } onClick={ () => setBlockOpen( true ) }>
						{ RESPONSE_LABEL.blockSteal }
					</Button>
				) }
				{ frame.allowPass && (
					<Button variant={ "neutral" } disabled={ disabled } onClick={ props.onPass }>
						{ "ALLOW IT" }
					</Button>
				) }
			</div>

			{ options.includes( "blockSteal" ) && blockOpen && (
				<div className={ "flex flex-col items-center gap-2" }>
					<p className={ "text-sm text-muted-foreground" }>
						{ "Which one are you claiming? Whoever challenges is challenging that." }
					</p>
					<div className={ "flex flex-wrap justify-center gap-2" }>
						{ STEAL_BLOCKERS.map( claim => (
							<CoupCardTile
								key={ claim }
								card={ claim }
								disabled={ disabled }
								onClick={ () => onBlockSteal( claim ) }
							/>
						) ) }
					</div>
					<Button variant={ "neutral" } onClick={ () => setBlockOpen( false ) }>
						{ "BACK" }
					</Button>
				</div>
			) }
		</>
	);
}
