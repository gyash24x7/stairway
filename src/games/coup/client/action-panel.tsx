"use client";

import { useState } from "react";

import { useCoup } from "@/games/coup/client/context.tsx";
import { claimFor, mustCoup, needsTarget } from "@/games/coup/shared/utils.ts";
import { Button } from "@/shared/ui/primitives/button.tsx";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger
} from "@/shared/ui/primitives/drawer.tsx";
import { RadioSelect } from "@/shared/ui/primitives/radio-select.tsx";

import type { ActionKind } from "@/games/coup/shared/schema.ts";
import type { PlayerId } from "@/swish/shared/schema.ts";

const LABEL: Record<ActionKind, string> = {
	income: "INCOME",
	foreignAid: "FOREIGN AID",
	coup: "COUP",
	tax: "TAX",
	assassinate: "ASSASSINATE",
	steal: "STEAL",
	exchange: "EXCHANGE"
};

const SUMMARY: Record<ActionKind, string> = {
	income: "Take 1 coin. Nobody can stop it.",
	foreignAid: "Take 2 coins. A Duke can stop it.",
	coup: "Pay 7 and take an influence. Nothing can stop it.",
	tax: "Take 3 coins as the Duke.",
	assassinate: "Pay 3 and take an influence, as the Assassin.",
	steal: "Take 2 coins, as the Captain.",
	exchange: "Draw 2 and keep the best, as the Ambassador."
};

/**
 * The turn: pick an action, then a target if it needs one.
 *
 * Only the actions the seat can afford are offered — that list comes from the
 * same `legalActions` the engine validates against, so a button is greyed out in
 * exactly the cases the command would be refused. What is *not* filtered is
 * whether the seat holds the character it is about to claim: bluffing is the
 * game, and the UI does not get an opinion about it.
 */
export function ActionPanel() {
	const { isMyTurn, actions, opponents, data, playerId, takeAction, isPending } = useCoup();

	const [ open, setOpen ] = useState( false );
	const [ action, setAction ] = useState<ActionKind>();

	if ( !isMyTurn || !playerId ) {
		return null;
	}

	const coins = data.view.playerData[ playerId ]?.coins ?? 0;
	const forced = mustCoup( coins );

	const close = () => {
		setOpen( false );
		setAction( undefined );
	};

	const submit = ( target?: PlayerId ) => takeAction(
		{ action: action!, ...( target === undefined ? {} : { target } ) },
		close
	);

	return (
		<Drawer open={ open } onOpenChange={ setOpen }>
			<DrawerTrigger asChild>
				<Button disabled={ isPending }>
					{ forced ? "YOU MUST COUP" : "TAKE AN ACTION" }
				</Button>
			</DrawerTrigger>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>{ action === undefined ? "YOUR TURN" : LABEL[ action ] }</DrawerTitle>
					<DrawerDescription>
						{ action === undefined
							? forced
								? "You are holding ten coins, so a coup is your only move."
								: "Claim whatever you like. Nobody checks until somebody calls it."
							: SUMMARY[ action ] }
					</DrawerDescription>
				</DrawerHeader>

				{ action === undefined && (
					<div className={ "px-4 flex flex-col gap-2" }>
						<RadioSelect
							options={ [ ...actions ] }
							value={ action }
							onChange={ next => next !== undefined && setAction( next ) }
							renderOption={ option => LABEL[ option ] }
						/>
					</div>
				) }

				{ action !== undefined && needsTarget( action ) && (
					<div className={ "px-4 flex flex-col gap-2" }>
						<label className={ "text-sm text-muted-foreground" }>Aim it at</label>
						<RadioSelect
							options={ [ ...opponents ] }
							value={ undefined }
							onChange={ target => target !== undefined && submit( target ) }
							renderOption={ option => data.players[ option ]?.name ?? "player" }
						/>
					</div>
				) }

				<DrawerFooter className={ "flex-row gap-3" }>
					{ action !== undefined && !needsTarget( action ) && (
						<Button className={ "flex-1" } disabled={ isPending } onClick={ () => submit() }>
							{ claimFor( action ) === undefined
								? "DO IT"
								: `CLAIM THE ${ claimFor( action )!.toUpperCase() }` }
						</Button>
					) }
					{ action !== undefined && (
						<Button
							className={ "flex-1" }
							variant={ "neutral" }
							disabled={ isPending }
							onClick={ () => setAction( undefined ) }
						>
							BACK
						</Button>
					) }
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
