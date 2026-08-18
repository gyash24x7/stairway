"use client";

import { CheckIcon, PencilIcon } from "lucide-react";
import { useState } from "react";

import { useFish } from "@/games/fish/client/context.tsx";
import { Button } from "@/shared/ui/primitives/button.tsx";
import { Input } from "@/shared/ui/primitives/input.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";
import { RPlayerInfoStrip } from "@/swish/client/player-info.tsx";
import { TeamName } from "@/swish/shared/schema.ts";
import { membersOf, nameOf, teamOf, teamSize } from "@/swish/shared/teams.ts";

import type { TeamId } from "@/swish/shared/schema.ts";

const fallbackName = ( index: number ) => `TEAM ${ index + 1 }`;

/**
 * The lobby's team formation. Sides belong to the engine now: `config.teams`
 * declares them, `joinTeam` takes one and `nameTeam` names it, and whoever picks
 * nothing is balanced into the emptiest side when the game starts. So there is
 * nothing to submit here and no way to get it wrong — every control is a single
 * command the server can refuse on its own terms.
 *
 * Naming is deliberately one-shot: the first member of a side to choose is the
 * one who names it, and the server refuses a second attempt, so the input
 * disappears rather than pretending to be editable.
 */
export function TeamLobby() {
	const { data, joinTeam, nameTeam, isPending } = useFish();

	const teams = data.config.teams;
	const size = teamSize( data.config ) ?? 0;
	const myTeam = teamOf( data.context, data.view.playerId );

	const unassigned = data.context.players.filter(
		playerId => teamOf( data.context, playerId ) === undefined
	);

	return (
		<div className={ "flex flex-col gap-3 w-full" }>
			<div className={ "grid grid-cols-1 md:grid-cols-2 gap-3" }>
				{ teams.map( ( team, index ) => {
					const members = membersOf( data.context, team );
					const chosen = nameOf( data.context, team );
					const isMine = myTeam === team;
					const isFull = members.length >= size;

					return (
						<div
							key={ team }
							className={ cn(
								"bg-background rounded-md p-3 flex flex-col gap-3",
								isMine && "border-2 border-accent"
							) }
						>
							<div className={ "flex items-center justify-between gap-2" }>
								<h2 className={ "text-xl md:text-2xl font-heading uppercase truncate" }>
									{ chosen ?? fallbackName( index ) }
								</h2>
								<span className={ "text-sm text-muted-foreground shrink-0" }>
									{ members.length }/{ size }
								</span>
							</div>

							<div className={ "flex gap-2 flex-wrap min-h-8 items-center" }>
								{ members.length > 0
									? members.map( playerId => (
										<RPlayerInfoStrip key={ playerId } player={ data.players[ playerId ] }/>
									) )
									: (
										<span className={ "text-sm text-muted-foreground" }>NOBODY YET</span>
									) }
							</div>

							<div className={ "flex gap-2 items-center" }>
								{ isMine
									? (
										<span
											className={ cn(
												"flex items-center gap-1 text-sm font-heading text-accent"
											) }
										>
											<CheckIcon className={ "w-4 h-4" }/> YOUR SIDE
										</span>
									)
									: (
										<Button
											size={ "sm" }
											onClick={ () => joinTeam( team ) }
											disabled={ isPending || isFull }
										>
											{ isFull ? "FULL" : "JOIN" }
										</Button>
									) }
								{ isMine && !chosen && (
									<NameTeam team={ team } onSubmit={ name => nameTeam( team, name ) }/>
								) }
							</div>
						</div>
					);
				} ) }
			</div>

			{ unassigned.length > 0 && (
				<div className={ "bg-background rounded-md p-3 flex flex-col gap-2" }>
					<p className={ "text-xs tracking-widest text-muted-foreground" }>
						NO SIDE YET — THEY'LL BE SPLIT EVENLY WHEN THE GAME STARTS
					</p>
					<div className={ "flex gap-2 flex-wrap" }>
						{ unassigned.map( playerId => (
							<RPlayerInfoStrip key={ playerId } player={ data.players[ playerId ] }/>
						) ) }
					</div>
				</div>
			) }
		</div>
	);
}

/** The one-shot name box for a side the caller is playing on. */
function NameTeam( props: { team: TeamId; onSubmit: ( name: TeamName ) => void } ) {
	const { isPending } = useFish();
	const [ open, setOpen ] = useState( false );
	const [ value, setValue ] = useState( "" );

	const trimmed = value.trim();
	const isValid = trimmed.length > 0 && trimmed.length <= 32;

	const submit = () => {
		if ( isValid ) {
			props.onSubmit( TeamName.make( trimmed ) );
		}
	};

	if ( !open ) {
		return (
			<Button
				size={ "sm" }
				variant={ "neutral" }
				className={ "flex gap-1 items-center" }
				onClick={ () => setOpen( true ) }
			>
				<PencilIcon className={ "w-3 h-3" }/>
				<span>NAME IT</span>
			</Button>
		);
	}

	return (
		<div className={ "flex gap-2 flex-1 min-w-0" }>
			<Input
				autoFocus
				value={ value }
				maxLength={ 32 }
				placeholder={ "Team name" }
				onChange={ e => setValue( e.target.value ) }
				onKeyDown={ e => e.key === "Enter" && submit() }
			/>
			<Button size={ "sm" } onClick={ submit } disabled={ !isValid || isPending }>
				{ isPending ? <Spinner size={ "sm" }/> : "SAVE" }
			</Button>
		</div>
	);
}
