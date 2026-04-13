"use client";

import { useFish } from "@/fish/components/context";
import { createTeams } from "@/fish/core/actions";
import { RPlayerInfo } from "@/shared/components/player-info";
import { Button } from "@/shared/primitives/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from "@/shared/primitives/dialog";
import { Input } from "@/shared/primitives/input";
import { Spinner } from "@/shared/primitives/spinner";
import { chunk, shuffle } from "@/shared/utils/array";
import { cn } from "@/shared/utils/cn";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useState } from "react";

export function CreateTeams() {
	const { match } = useFish();
	const [ teamNames, setTeamNames ] = useState<string[]>( [] );
	const [ teamMemberData, setTeamMemberData ] = useState<Record<string, string[]>>( {} );
	const [ open, setOpen ] = useState( false );

	const groupPlayers = () => {
		const teamMembers = chunk(
			shuffle( match.state.ctx.players ),
			match.config.playerCount / match.config.teamCount
		);

		setTeamMemberData( teamNames.reduce(
			( acc, name, idx ) => {
				acc[ name ] = teamMembers[ idx ] || [];
				return acc;
			},
			{} as Record<string, string[]>
		) );
	};

	const createTeamsFn = useServerFn( createTeams );
	const { isPending, mutate } = useMutation( { mutationFn: createTeamsFn } );

	const handleCreateTeams = () => mutate( { data: { matchId: match.id, teams: teamMemberData } } );

	return (
		<Dialog open={ open } onOpenChange={ setOpen }>
			<Button onClick={ () => setOpen( true ) }>CREATE TEAMS</Button>
			<DialogContent className={ "w-full max-w-xl" }>
				<DialogHeader>
					<DialogTitle>CREATE TEAMS</DialogTitle>
					<DialogDescription/>
				</DialogHeader>
				<div className={ cn( "grid grid-cols-1 gap-2", match.config.teamCount === 4 && "grid-cols-2" ) }>
					{ Array( match.config.teamCount ).fill( null ).map( ( _, idx ) => (
						<Input
							key={ idx }
							type="text"
							placeholder={ `Enter Team ${ idx + 1 } Name` }
							value={ teamNames[ idx ] || "" }
							onChange={ ( e ) => {
								const newNames = [ ...teamNames ];
								newNames[ idx ] = e.target.value;
								setTeamNames( newNames );
							} }
						/>
					) ) }
				</div>
				<Button
					className={ "w-full" }
					onClick={ groupPlayers }
					disabled={ teamNames.filter( n => !!n ).length !== match.config.teamCount }
				>
					GROUP PLAYERS
				</Button>
				{ Object.keys( teamMemberData ).length === match.config.teamCount && (
					<div className={ "flex flex-col gap-2" }>
						{ Object.keys( teamMemberData ).map( teamName => (
							<Fragment key={ teamName }>
								<h2>Team { teamName }</h2>
								<div className={ "flex gap-2" }>
									{ teamMemberData[ teamName ].map( player => (
										<RPlayerInfo player={ match.players[ player ] } key={ player }/>
									) ) }
								</div>
							</Fragment>
						) ) }
					</div>
				) }
				<DialogFooter>
					<Button onClick={ handleCreateTeams } disabled={ isPending } className={ "w-full" }>
						{ isPending ? <Spinner/> : "CREATE TEAMS" }
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}