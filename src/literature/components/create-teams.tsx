"use client";

import { chunk, shuffle } from "@/shared/cards/utils";
import { PlayerLobby } from "@/literature/components/player-lobby";
import { createTeams } from "@/literature/server/functions";
import { store } from "@/literature/store";
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
import { Spinner } from "@/shared/primitives/spinner";
import { useStore } from "@tanstack/react-store";
import { useState, useTransition } from "react";

export function CreateTeams() {
	const [ isPending, startTransition ] = useTransition();
	const gameId = useStore( store, state => state.game.id );
	const players = useStore( store, state => state.players );
	const playerCount = useStore( store, state => state.game.playerCount );

	const [ teamAName, setTeamAName ] = useState( "" );
	const [ teamBName, setTeamBName ] = useState( "" );
	const [ teamMemberData, setTeamMemberData ] = useState<Record<string, string[]>>( {} );

	const [ open, setOpen ] = useState( false );

	const groupPlayers = () => {
		const teamMembers = chunk( shuffle( Object.keys( players ) ), playerCount / 2 );
		setTeamMemberData( {
			[ teamAName ]: teamMembers[ 0 ],
			[ teamBName ]: teamMembers[ 1 ]
		} );
	};

	const handleCreateTeams = () => startTransition( async () => {
		await createTeams( { gameId, data: teamMemberData } );
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
					<Input
						type="text"
						placeholder="Enter Team Name"
						value={ teamAName }
						onChange={ ( e ) => setTeamAName( e.target.value ) }
					/>
					<Input
						type="text"
						placeholder="Enter Team Name"
						value={ teamBName }
						onChange={ ( e ) => setTeamBName( e.target.value ) }
					/>
					<Button
						className={ "w-full" }
						onClick={ groupPlayers }
						disabled={ !teamAName || !teamBName || teamAName === teamBName }
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