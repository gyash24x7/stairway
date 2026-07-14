"use client";

import { useAuth } from "@s2h-ui/auth/use-auth";
import type { PlayerId } from "@s2h/swish/schema";
import { RPlayerInfo } from "@s2h/ui/components/player-info";
import { Button } from "@s2h/ui/primitives/button";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@s2h/ui/primitives/drawer";
import { Input } from "@s2h/ui/primitives/input";
import { Spinner } from "@s2h/ui/primitives/spinner";
import { cn } from "@s2h/ui/utils/cn";
import { chunk, shuffle } from "@s2h/utils/array";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { createTeamsFn, toPlayerInfo } from "./client";
import { useFish } from "./context";

export function CreateTeams() {
	const { shared } = useFish();
	const { authInfo } = useAuth();
	const [ teamNames, setTeamNames ] = useState<string[]>( [] );
	const [ teamMemberData, setTeamMemberData ] = useState<Record<string, PlayerId[]>>( {} );
	const [ open, setOpen ] = useState( false );

	const teamsNotCreated = Object.keys( teamMemberData ).length === 0;

	const groupPlayers = () => {
		const teamMembers = chunk(
			shuffle( [ ...shared.context.players ] ),
			shared.config.playerCount / shared.config.teamCount
		);

		setTeamMemberData( teamNames.reduce(
			( acc, name, idx ) => {
				acc[ name ] = teamMembers[ idx ] || [];
				return acc;
			},
			{} as Record<string, PlayerId[]>
		) );
	};

	const closeDrawer = () => setOpen( false );

	const queryClient = useQueryClient();

	const createTeams = useMutation( {
		mutationFn: () => createTeamsFn(
			shared.id,
			toPlayerInfo( authInfo! ),
			{ teams: teamMemberData }
		),
		onSuccess: () => queryClient.invalidateQueries( {
			queryKey: [ "fish", "getState", shared.id ]
		} )
	} );

	const handleCreateTeams = async () => {
		if ( teamsNotCreated || !authInfo ) {
			return;
		}

		await createTeams.mutateAsync();
		closeDrawer();
	};

	return (
		<Drawer open={ open } onOpenChange={ setOpen }>
			<Button onClick={ () => setOpen( true ) }>CREATE TEAMS</Button>
			<DrawerContent>
				<DrawerHeader>
					<DrawerTitle>CREATE TEAMS</DrawerTitle>
					<DrawerDescription/>
				</DrawerHeader>
				<div className={ "px-4 flex flex-col gap-3 overflow-y-auto" }>
					<div
						className={ cn(
							"grid grid-cols-1 gap-2",
							shared.config.teamCount === 4 && "grid-cols-2"
						) }
					>
						{ Array( shared.config.teamCount ).fill( null ).map( ( _, idx ) => (
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
						disabled={ teamNames.filter( n => !!n ).length !== shared.config.teamCount }
					>
						GROUP PLAYERS
					</Button>
					{ Object.keys( teamMemberData ).length === shared.config.teamCount && (
						<div className={ "flex flex-col gap-2" }>
							{ Object.keys( teamMemberData ).map( teamName => (
								<Fragment key={ teamName }>
									<h2>Team { teamName }</h2>
									<div className={ "flex gap-2" }>
										{ teamMemberData[ teamName ].map( player => (
											<RPlayerInfo player={ shared.players[ player ] } key={ player }/>
										) ) }
									</div>
								</Fragment>
							) ) }
						</div>
					) }
				</div>
				<DrawerFooter>
					<Button
						onClick={ handleCreateTeams }
						disabled={ createTeams.isPending || teamsNotCreated }
						className={ "w-full" }
					>
						{ createTeams.isPending ? <Spinner/> : "CREATE TEAMS" }
					</Button>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}