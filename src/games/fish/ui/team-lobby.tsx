import * as Exit from "effect/Exit";

import { useAtomSet, useAtomValue } from "@effect/atom-react";

import { cn } from "cn";
import { CheckIcon, PencilIcon } from "lucide-react";
import { useState } from "react";

import type { FishConfig, FishView } from "@/games/fish/schema";
import { joinTeamAtom, leaveTeamAtom, nameTeamAtom } from "@/games/fish/ui/client";
import { Button } from "@/shared/primitives/button";
import { Input } from "@/shared/primitives/input";
import { toast } from "@/shared/primitives/sonner";
import { Spinner } from "@/shared/primitives/spinner";
import { causeMessage } from "@/shared/shell/errors";
import type { GameView, PlayerId } from "@/swish/schema";
import { GameId, JoinTeamInput, NameTeamInput, TeamName } from "@/swish/schema";
import { RPlayerInfoStrip } from "@/swish/ui/player-info";
import { membersOf, nameOf, teamOf, teamSize } from "@/swish/utils";


const fallbackName = ( index: number ) => `TEAM ${ index + 1 }`;

const report = ( exit: Exit.Exit<unknown, unknown> ) => {
	if ( Exit.isFailure( exit ) ) {
		toast.error( causeMessage( exit.cause ) );
	}
};

export type TeamLobbyProps = {
	readonly game: GameView<FishView, FishConfig>;
	readonly me: PlayerId;
	readonly gameId: string;
	/** A watcher sees the sides form but takes no part in forming them. */
	readonly readOnly?: boolean;
};

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
 *
 * Leaving is the counterpart to joining and exists because sides are
 * equal-sized: a seat can only move somewhere with room, so a table whose sides
 * are all taken — a rematch that carried them over, most obviously — could not
 * rearrange itself at all without somebody stepping off first.
 */
export function TeamLobby( { game, me, gameId, readOnly }: TeamLobbyProps ) {
	const joinTeam = useAtomSet( joinTeamAtom, { mode: "promiseExit" } );
	const leaveTeam = useAtomSet( leaveTeamAtom, { mode: "promiseExit" } );
	const nameTeam = useAtomSet( nameTeamAtom, { mode: "promiseExit" } );

	const joining = useAtomValue( joinTeamAtom ).waiting;
	const leaving = useAtomValue( leaveTeamAtom ).waiting;
	const naming = useAtomValue( nameTeamAtom ).waiting;
	const isPending = joining || leaving || naming;

	const params = { gameId: GameId.make( gameId ) };

	const teams = game.config.teams;
	const size = teamSize( game.config ) ?? 0;
	const myTeam = teamOf( game.context, me );

	const unassigned = game.context.players.filter(
		playerId => teamOf( game.context, playerId ) === undefined
	);

	return (
		<div className={ "flex flex-col gap-3 w-full" }>
			<div className={ "grid grid-cols-1 md:grid-cols-2 gap-3" }>
				{ teams.map( ( team, index ) => {
					const members = membersOf( game.context, team );
					const chosen = nameOf( game.context, team );
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
									? members.map( playerId => {
										const player = game.players[ playerId ];
										return player
											? <RPlayerInfoStrip key={ playerId } player={ player }/>
											: null;
									} )
									: (
										<span className={ "text-sm text-muted-foreground" }>NOBODY YET</span>
									) }
							</div>

							{ !readOnly && (
								<div className={ "flex gap-2 items-center" }>
									{ isMine
										? (
											<div className={ "flex items-center gap-2" }>
											<span
												className={ cn(
													"flex items-center gap-1 text-sm font-heading text-accent"
												) }
											>
												<CheckIcon className={ "w-4 h-4" }/> YOUR SIDE
											</span>
												<Button
													size={ "sm" }
													variant={ "neutral" }
													onClick={ async () => report(
														await leaveTeam( { params } )
													) }
													disabled={ isPending }
												>
													LEAVE
												</Button>
											</div>
										)
										: (
											<Button
												size={ "sm" }
												onClick={ async () => report( await joinTeam( {
													params,
													payload: JoinTeamInput.make( { team } )
												} ) ) }
												disabled={ isPending || isFull }
											>
												{ isFull ? "FULL" : "JOIN" }
											</Button>
										) }
									{ isMine && !chosen && (
										<NameTeam
											disabled={ isPending }
											onSubmit={ async name => report( await nameTeam( {
												params,
												payload: NameTeamInput.make( { team, name } )
											} ) ) }
										/>
									) }
								</div>
							) }
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
						{ unassigned.map( playerId => {
							const player = game.players[ playerId ];
							return player
								? <RPlayerInfoStrip key={ playerId } player={ player }/>
								: null;
						} ) }
					</div>
				</div>
			) }
		</div>
	);
}

/** The one-shot name box for a side the caller is playing on. */
function NameTeam( props: { disabled: boolean; onSubmit: ( name: TeamName ) => void } ) {
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
			<Button size={ "sm" } onClick={ submit } disabled={ !isValid || props.disabled }>
				{ props.disabled ? <Spinner size={ "sm" }/> : "SAVE" }
			</Button>
		</div>
	);
}
