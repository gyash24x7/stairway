"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Fragment, useState } from "react";

import { useAuth } from "@/auth/client/use-auth.tsx";
import type { PlayerId } from "@/shared/swish/schema.ts";
import { RPlayerInfo } from "@/shared/ui/components/player-info.tsx";
import { Button } from "@/shared/ui/primitives/button.tsx";
import {
	Drawer,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle
} from "@/shared/ui/primitives/drawer.tsx";
import { Input } from "@/shared/ui/primitives/input.tsx";
import { Spinner } from "@/shared/ui/primitives/spinner.tsx";
import { cn } from "@/shared/ui/utils/cn.ts";
import { chunk, shuffle } from "@/shared/utils/array.ts";
import { createTeamsFn } from "@/games/fish/client/client.ts";
import { useFish } from "@/games/fish/client/context.tsx";

export function CreateTeams() {
	const { data } = useFish();
	const { authInfo } = useAuth();
	const [ teamNames, setTeamNames ] = useState<string[]>( [] );
	const [ teamMemberData, setTeamMemberData ] = useState<Record<string, PlayerId[]>>( {} );
	const [ open, setOpen ] = useState( false );

	const teamsNotCreated = Object.keys( teamMemberData ).length === 0;

	const groupPlayers = () => {
		const teamMembers = chunk(
			shuffle( [ ...data.context.players ] ),
			data.config.playerCount / data.config.teamCount
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
		mutationFn: () => createTeamsFn( data.id, { teams: teamMemberData } ),
		onSuccess: () => queryClient.invalidateQueries( {
			queryKey: [ "fish", "getState", data.id ]
		} )
	} );

	const handleCreateTeams = () => {
		if ( teamsNotCreated || !authInfo ) {
			return;
		}

		createTeams.mutate( undefined, { onSuccess: closeDrawer } );
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
							data.config.teamCount === 4 && "grid-cols-2"
						) }
					>
						{ Array( data.config.teamCount ).fill( null ).map( ( _, idx ) => (
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
						disabled={ teamNames.filter( n => !!n ).length !== data.config.teamCount }
					>
						GROUP PLAYERS
					</Button>
					{ Object.keys( teamMemberData ).length === data.config.teamCount && (
						<div className={ "flex flex-col gap-2" }>
							{ Object.keys( teamMemberData ).map( teamName => (
								<Fragment key={ teamName }>
									<h2>Team { teamName }</h2>
									<div className={ "flex gap-2" }>
										{ teamMemberData[ teamName ].map( player => (
											<RPlayerInfo player={ data.players[ player ] } key={ player }/>
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