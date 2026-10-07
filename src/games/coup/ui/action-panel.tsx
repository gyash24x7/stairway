import { cn } from "cn";

import type { CoupActionName, CoupView } from "@/games/coup/schema";
import { COUP_ASSASSINATE_COST, COUP_COUP_COST, COUP_FORCED_COUP_COINS } from "@/games/coup/schema";
import { Button } from "@/shared/primitives/button";
import type { PlayerId, Roster } from "@/swish/schema";


/** The actions that need somebody to aim at before they can be sent. */
export const AIMED_ACTIONS: ReadonlyArray<CoupActionName> = [ "coup", "assassinate", "steal" ];

type ActionSpec = {
	readonly action: CoupActionName;
	readonly label: string;
	/** The character the action rests on, shown so a bluff is made knowingly. */
	readonly claim?: string;
	readonly hint: string;
};

const ACTIONS: ReadonlyArray<ActionSpec> = [
	{ action: "income", label: "INCOME", hint: "Take 1 coin. Unquestionable." },
	{ action: "foreignAid", label: "FOREIGN AID", hint: "Take 2 coins. A Duke can stop it." },
	{
		action: "coup",
		label: "COUP",
		hint: `Pay ${ COUP_COUP_COST }. Takes an influence, and cannot be stopped.`
	},
	{ action: "tax", label: "TAX", claim: "DUKE", hint: "Take 3 coins." },
	{
		action: "assassinate",
		label: "ASSASSINATE",
		claim: "ASSASSIN",
		hint: `Pay ${ COUP_ASSASSINATE_COST }, win or lose. A Contessa stops it.`
	},
	{ action: "steal", label: "STEAL", claim: "CAPTAIN", hint: "Take 2 from someone." },
	{
		action: "exchange",
		label: "EXCHANGE",
		claim: "AMBASSADOR",
		hint: "Draw 2, keep what you like."
	}
];

/**
 * Why an action is not available to this seat right now, or `undefined` when it
 * is.
 *
 * Mirrors the engine's own `validate` rather than replacing it — the server still
 * refuses — so this is an affordance: a player who cannot afford an assassination
 * should be told the price, not told "no" after a round trip.
 */
const unavailable = (
	action: CoupActionName,
	view: CoupView,
	me: PlayerId,
	aliveOthers: ReadonlyArray<PlayerId>
) => {
	const coins = view.coins[ me ] ?? 0;
	const forced = coins >= COUP_FORCED_COUP_COINS;

	if ( forced && action !== "coup" ) {
		return `${ COUP_FORCED_COUP_COINS }+ coins — you must coup`;
	}

	if ( action === "coup" && coins < COUP_COUP_COST ) {
		return `Needs ${ COUP_COUP_COST } coins`;
	}

	if ( action === "assassinate" && coins < COUP_ASSASSINATE_COST ) {
		return `Needs ${ COUP_ASSASSINATE_COST } coins`;
	}

	if ( action === "steal" && aliveOthers.every( id => ( view.coins[ id ] ?? 0 ) === 0 ) ) {
		return "Nobody has anything to take";
	}

	if ( AIMED_ACTIONS.includes( action ) && aliveOthers.length === 0 ) {
		return "Nobody left to aim at";
	}

	return undefined;
};

export type CoupActionPanelProps = {
	readonly view: CoupView;
	readonly players: Roster;
	readonly me: PlayerId;
	/** Everyone still in the game apart from this seat, in seat order. */
	readonly aliveOthers: ReadonlyArray<PlayerId>;
	/** The aimed action waiting on a target, if one is being composed. */
	readonly armed?: CoupActionName;
	readonly target?: PlayerId;
	readonly onArm: ( action: CoupActionName | undefined ) => void;
	readonly onPlay: ( action: CoupActionName, target?: PlayerId ) => void;
	readonly disabled?: boolean;
};

/**
 * The seven things a turn can be.
 *
 * The character each action rests on is printed on the button, which is the whole
 * design: in Coup you may play any of these whatever you are holding, and the
 * only thing that stops you is somebody calling it. A player should be able to
 * bluff a Duke on purpose, which means seeing that Tax *is* a Duke claim before
 * they press it — not discovering it when they are challenged.
 *
 * Aimed actions arm rather than fire. Pressing STEAL does not send anything; it
 * puts the table into target-picking, and the seats grow a TARGET button. Two
 * taps for something irreversible, on a phone, aimed at a person.
 */
export function CoupActionPanel( props: CoupActionPanelProps ) {
	const { view, players, me, aliveOthers, armed, target, onArm, onPlay, disabled } = props;

	if ( armed ) {
		const spec = ACTIONS.find( a => a.action === armed );
		const targetName = target ? players[ target ]?.name : undefined;

		return (
			<div className={ "flex w-full flex-col items-center gap-2" }>
				<p className={ "text-status text-center" }>
					{ targetName
						? `${ spec?.label } ${ targetName.toUpperCase() }?`
						: `${ spec?.label } — PICK A TARGET` }
				</p>
				<div className={ "flex flex-wrap justify-center gap-2" }>
					<Button
						onClick={ () => target && onPlay( armed, target ) }
						disabled={ disabled || !target }
					>
						{ "CONFIRM" }
					</Button>
					<Button variant={ "neutral" } onClick={ () => onArm( undefined ) }>
						{ "CANCEL" }
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className={ "grid w-full grid-cols-2 gap-2 md:grid-cols-4" }>
			{ ACTIONS.map( spec => {
				const reason = unavailable( spec.action, view, me, aliveOthers );
				const aimed = AIMED_ACTIONS.includes( spec.action );

				return (
					<button
						key={ spec.action }
						type={ "button" }
						title={ reason ?? spec.hint }
						disabled={ disabled || !!reason }
						onClick={ () => aimed ? onArm( spec.action ) : onPlay( spec.action ) }
						className={ cn(
							"flex flex-col items-start gap-0.5 rounded-base border-2 border-outline",
							"bg-background px-3 py-2 text-left transition",
							!reason && !disabled && "cursor-pointer hover:bg-accent/20",
							( !!reason || disabled ) && "cursor-not-allowed opacity-50"
						) }
					>
						<span className={ "font-heading text-sm" }>{ spec.label }</span>
						<span className={ "text-[10px] text-muted-foreground" }>
							{ reason ?? ( spec.claim ? `Claims ${ spec.claim }` : "Claims nothing" ) }
						</span>
					</button>
				);
			} ) }
		</div>
	);
}
