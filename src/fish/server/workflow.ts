import { addBots, addPlayer, createGame, createTeams, startGame } from "@/libs/fish/engine";
import type {
	BasePlayerInfo,
	CreateGameInput,
	CreateTeamsInput,
	FishGameConfig,
	FishTeamCount,
	PlayerId,
	StartGameInput
} from "@/libs/fish/types";
import { chunk } from "@/shared/utils/array";
import { generateTeamName } from "@/shared/utils/generator";
import { createLogger } from "@/shared/utils/logger";
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";

export class FishWorkflow extends WorkflowEntrypoint<Env, CreateGameInput> {

	private readonly logger = createLogger( "Fish:Workflow" );

	override async run( { payload, instanceId }: WorkflowEvent<CreateGameInput>, step: WorkflowStep ) {

		let data = await step.do( "initialize game", async () => this.initialize( payload, instanceId ) );

		while ( data.playerIds.length !== data.config.playerCount ) {
			try {
				const { payload } = await step.waitForEvent<BasePlayerInfo>(
					"wait for players to join",
					{ type: "join-game", timeout: "2 minutes" }
				);

				data = addPlayer( payload, data );
			} catch ( e ) {
				this.logger.debug( "Timeout waiting for players to join, adding bots!" );
				data = addBots( data );
			}

			await this.env.FISH_KV.put( data.id, JSON.stringify( data ) );
		}

		try {
			const { payload } = await step.waitForEvent<CreateTeamsInput>(
				"wait for teams to get created",
				{ type: "create-teams", timeout: "2 minutes" }
			);

			data = createTeams( payload, data );
		} catch ( e ) {
			this.logger.debug( "Timeout waiting for teams to get created! Auto creating!" );

			const input = {
				gameId: data.id,
				teamCount: data.config.teamCount,
				data: this.getDefaultTeamData( data.config.teamCount, data.playerIds )
			};

			data = createTeams( input, data );
		}

		await this.env.FISH_KV.put( data.id, JSON.stringify( data ) );

		try {
			const { payload } = await step.waitForEvent<StartGameInput>(
				"wait for game to start",
				{ type: "start-game", timeout: "2 minutes" }
			);

			data = startGame( payload, data );
		} catch ( e ) {
			this.logger.debug( "Timeout waiting for game to start! Auto starting!" );
			data = startGame( { type: "NORMAL", deckType: 48, gameId: data.id }, data );
		}

		await this.env.FISH_KV.put( data.id, JSON.stringify( data ) );
	}

	private async initialize( payload: CreateGameInput, instanceId: string ) {
		const config: FishGameConfig = {
			type: "NORMAL",
			playerCount: payload.playerCount ?? 6,
			teamCount: 2,
			books: [],
			deckType: 48
		};

		const data = createGame( config, payload.playerId! );
		await this.env.FISH_KV.put( data.id, JSON.stringify( data ) );
		await this.env.FISH_KV.put( `code_${ data.code }`, data.id );
		await this.env.FISH_KV.put( `workflow_${ data.id }`, instanceId );

		return data;
	}

	private getDefaultTeamData( teamCount: FishTeamCount, players: PlayerId[] ) {
		const names = Array( teamCount ).fill( 0 ).map( () => generateTeamName() );
		const groups = chunk( players, players.length / teamCount );
		return names.reduce(
			( acc, name, idx ) => {
				acc[ name ] = groups[ idx ];
				return acc;
			},
			{} as Record<string, PlayerId[]>
		);
	}
}