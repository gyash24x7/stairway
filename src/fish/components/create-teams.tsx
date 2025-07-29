"use client";

import { PlayerLobby } from "@/fish/components/player-lobby";
import { createTeams } from "@/fish/server/functions";
import { store } from "@/fish/store";
import type { FishTeamCount } from "@/libs/fish/types";
import { Button } from "@/shared/primitives/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from "@/shared/primitives/dialog";
import { Input } from "@/shared/primitives/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/primitives/select";
import { Spinner } from "@/shared/primitives/spinner";
import { chunk, shuffle } from "@/shared/utils/array";
import { useStore } from "@tanstack/react-store";
import { useState, useTransition } from "react";

export function CreateTeams() {
	const [ isPending, startTransition ] = useTransition();
	const gameId = useStore( store, state => state.id );
	const players = useStore( store, state => state.players );
	const playerCount = useStore( store, state => state.config.playerCount );

	const [ teamCount, setTeamCount ] = useState<FishTeamCount>( 0 );
	const [ teamNames, setTeamNames ] = useState<string[]>( [] );
	const [ teamMemberData, setTeamMemberData ] = useState<Record<string, string[]>>( {} );

	const [ open, setOpen ] = useState( false );

	const groupPlayers = () => {
		const teamMembers = chunk( shuffle( Object.keys( players ) ), playerCount / teamCount );
		setTeamMemberData( teamNames.reduce(
			( acc, name, idx ) => {
				acc[ name ] = teamMembers[ idx ] || [];
				return acc;
			},
			{} as Record<string, string[]>
		) );
	};

	const handleCreateTeams = () => startTransition( async () => {
		await createTeams( { gameId, data: teamMemberData, teamCount } );
		setOpen( false );
	} );

	return (
		<Dialog open={ open } onOpenChange={ setOpen }>
			<DialogTrigger asChild>
				<Button className={ "flex-1 max-w-lg" }>CREATE TEAMS</Button>
			</DialogTrigger>
			<DialogContent className={ "w-full max-w-xl" }>
				<DialogHeader>
					<DialogTitle>CREATE TEAMS</DialogTitle>
				</DialogHeader>
				<div className={ "flex flex-col gap-3" }>
					<Select
						value={ teamCount.toString() }
						onValueChange={ ( value ) => setTeamCount( parseInt( value ) as FishTeamCount ) }
					>
						<SelectTrigger className={ "w-full" }>
							<SelectValue placeholder={ "Select Team Count" }/>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="2">2 TEAMS</SelectItem>
							<SelectItem value="3">3 TEAMS</SelectItem>
							<SelectItem value="4">4 TEAMS</SelectItem>
							<SelectItem value="5">5 TEAMS</SelectItem>
							<SelectItem value="6">6 TEAMS</SelectItem>
						</SelectContent>
					</Select>
					{ Array( teamCount ).fill( null ).map( ( _, idx ) => (
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
					<Button
						className={ "w-full" }
						onClick={ groupPlayers }
						disabled={ teamCount !== 0 || teamNames.length !== teamCount }
					>
						GROUP PLAYERS
					</Button>
					<div className={ "flex flex-col gap-3" }>
						{ Object.keys( teamMemberData ).map( ( team ) => (
							<div key={ team } className={ "flex flex-col gap-2" }>
								<h3 className={ "font-semibold" }>Team { team }</h3>
								<PlayerLobby withBg playerIds={ teamMemberData[ team ] }/>
							</div>
						) ) }
					</div>
				</div>
				<DialogFooter>
					<Button onClick={ handleCreateTeams } disabled={ isPending } className={ "w-full" }>
						{ isPending ? <Spinner/> : "CREATE TEAMS" }
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}