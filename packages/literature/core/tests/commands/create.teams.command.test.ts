import { afterEach, describe, expect, it } from "vitest";
import type { CreateTeamsInput } from "@literature/data";
import { GameStatus } from "@literature/data";
import { mockClear, mockDeep } from "vitest-mock-extended";
import type { PrismaService } from "@s2h/core";
import type { EventBus } from "@nestjs/cqrs";
import { CreateTeamsCommand, CreateTeamsCommandHandler } from "../../src/commands";
import { GameUpdateEvent } from "../../src/events";
import type { HttpException } from "@nestjs/common";
import { Messages } from "../../src/constants";
import {
	buildMockAggregatedGameData,
	mockAuthInfo,
	mockPlayer1,
	mockPlayer2,
	mockPlayer3,
	mockPlayer4,
	mockTeamA,
	mockTeamB
} from "../mockdata";

describe( "CreateTeamsCommand", () => {
	const mockInput: CreateTeamsInput = {
		data: {
			[ mockTeamA.name ]: [ mockPlayer1.id, mockPlayer3.id ],
			[ mockTeamB.name ]: [ mockPlayer2.id, mockPlayer4.id ]
		}
	};

	const mockAggregatedGameData = buildMockAggregatedGameData( GameStatus.PLAYERS_READY );
	const mockPrisma = mockDeep<PrismaService>();
	const mockEventBus = mockDeep<EventBus>();

	it( "should throw error if game is not in PLAYERS_READY status", async () => {
		const handler = new CreateTeamsCommandHandler( mockPrisma, mockEventBus );

		expect.assertions( 2 );
		handler.execute( new CreateTeamsCommand(
			mockInput,
			{ ...mockAggregatedGameData, status: GameStatus.CREATED },
			mockAuthInfo
		) ).catch( ( err: HttpException ) => {
			expect( err.getStatus() ).toEqual( 400 );
			expect( err.message ).toEqual( Messages.GAME_NOT_IN_REQUIRED_STATUS );
		} );
	} );

	it( "should throw error if playerCount is less than required", async () => {
		const handler = new CreateTeamsCommandHandler( mockPrisma, mockEventBus );

		expect.assertions( 2 );
		handler.execute( new CreateTeamsCommand(
			mockInput,
			{ ...mockAggregatedGameData, playerCount: 6 },
			mockAuthInfo
		) ).catch( ( err: HttpException ) => {
			expect( err.getStatus() ).toEqual( 400 );
			expect( err.message ).toEqual( Messages.GAME_DOESNT_HAVE_ENOUGH_PLAYERS );
		} );
	} );

	it( "should create teams and assign teams to players", async () => {
		mockPrisma.literature.team.create.mockResolvedValueOnce( mockTeamA ).mockResolvedValueOnce( mockTeamB );
		const handler = new CreateTeamsCommandHandler( mockPrisma, mockEventBus );
		const result = await handler.execute( new CreateTeamsCommand(
			mockInput,
			mockAggregatedGameData,
			mockAuthInfo
		) );

		expect( result ).toEqual( mockAggregatedGameData.id );
		expect( mockPrisma.literature.team.create ).toHaveBeenCalledTimes( 2 );
		expect( mockPrisma.literature.team.create ).toHaveBeenCalledWith( {
			data: {
				name: "Team A",
				gameId: "1",
				members: {
					connect: [
						{ id_gameId: { id: "1", gameId: "1" } },
						{ id_gameId: { id: "3", gameId: "1" } }
					]
				}
			}
		} );
		expect( mockPrisma.literature.team.create ).toHaveBeenCalledWith( {
			data: {
				name: "Team B",
				gameId: "1",
				members: {
					connect: [
						{ id_gameId: { id: "2", gameId: "1" } },
						{ id_gameId: { id: "4", gameId: "1" } }
					]
				}
			}
		} );
		expect( mockAggregatedGameData.teamList ).toEqual( [ mockTeamA, mockTeamB ] );
		expect( mockAggregatedGameData.teams ).toEqual( {
			[ mockTeamA.id ]: mockTeamA,
			[ mockTeamB.id ]: mockTeamB
		} );
		expect( mockAggregatedGameData.players[ mockPlayer1.id ].teamId ).toEqual( mockTeamA.id );
		expect( mockAggregatedGameData.players[ mockPlayer2.id ].teamId ).toEqual( mockTeamB.id );
		expect( mockPrisma.literature.game.update ).toHaveBeenCalledTimes( 1 );
		expect( mockPrisma.literature.game.update ).toHaveBeenCalledWith( {
			where: { id: mockAggregatedGameData.id },
			data: { status: GameStatus.TEAMS_CREATED }
		} );
		expect( mockAggregatedGameData.status ).toEqual( GameStatus.TEAMS_CREATED );
		expect( mockEventBus.publish ).toHaveBeenCalledTimes( 1 );
		expect( mockEventBus.publish )
			.toHaveBeenCalledWith( new GameUpdateEvent( mockAggregatedGameData, mockAuthInfo ) );
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockEventBus );
	} );
} );