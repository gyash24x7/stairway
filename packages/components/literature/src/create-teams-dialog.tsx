import {
	Button,
	Drawer,
	DrawerContent,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
	Input
} from "@base/components";
import { useGameId, usePlayerCount, usePlayers } from "@literature/store";
import { chunk, shuffle } from "@stairway/cards";
import { useCallback, useState } from "react";
import { DisplayPlayer } from "./display-player.tsx";
import { CreateTeams } from "./game-actions.tsx";

export const CreateTeamsDialog = () => {
	const gameId = useGameId();
	const players = usePlayers();
	const playerCount = usePlayerCount();

	const [ teamAName, setTeamAName ] = useState( "" );
	const [ teamBName, setTeamBName ] = useState( "" );
	const [ teamMemberData, setTeamMemberData ] = useState<Record<string, string[]>>( {} );

	const [ open, setOpen ] = useState( false );

	const groupPlayers = useCallback( () => {
		const teamMembers = chunk( shuffle( Object.keys( players ) ), playerCount / 2 );
		setTeamMemberData( {
			[ teamAName ]: teamMembers[ 0 ],
			[ teamBName ]: teamMembers[ 1 ]
		} );
	}, [ teamAName, teamBName, players, playerCount ] );

	return (
		<Drawer open={ open } onOpenChange={ setOpen }>
			<DrawerTrigger asChild>
				<Button className={ "flex-1 max-w-lg" }>CREATE TEAMS</Button>
			</DrawerTrigger>
			<DrawerContent>
				<div className={ "mx-auto w-full max-w-lg" }>
					<DrawerHeader>
						<DrawerTitle>Create Teams</DrawerTitle>
					</DrawerHeader>
					<div className={ "flex flex-col gap-3 px-4" }>
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
						<Button className={ "w-full" } onClick={ groupPlayers }>GROUP PLAYERS</Button>
						<div className={ "flex flex-col gap-3" }>
							{ Object.keys( teamMemberData ).map( ( team ) => (
								<div key={ team } className={ "flex flex-col gap-2" }>
									<h3 className={ "font-semibold" }>Team { team }</h3>
									<div className={ "flex flex-wrap gap-2" }>
										{ teamMemberData[ team ]?.map( member => players[ member ] ).map( player => (
											<DisplayPlayer player={ player } key={ player.id }/>
										) ) }
									</div>
								</div>
							) ) }
						</div>
					</div>
					<DrawerFooter>
						<CreateTeams gameId={ gameId } data={ teamMemberData } onSubmit={ () => setOpen( false ) }/>
					</DrawerFooter>
				</div>
			</DrawerContent>
		</Drawer>
	);
};