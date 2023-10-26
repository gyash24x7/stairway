import { afterEach, describe, expect, it } from "vitest";
import type { CreateTeamsInput } from "@literature/types";
import { GameStatus } from "@literature/types";
import { mockClear, mockDeep } from "vitest-mock-extended";
import type { PrismaService } from "@s2h/core";
import type { EventBus } from "@nestjs/cqrs";
import { CreateTeamsCommand, CreateTeamsCommandHandler } from "../../src/commands";
import type { HttpException } from "@nestjs/common";
import { Messages } from "../../src/constants";
import {
	buildMockGameData,
	mockPlayer1,
	mockPlayer2,
	mockPlayer3,
	mockPlayer4,
	mockTeamA,
	mockTeamB
} from "../mockdata";
import { TeamsCreatedEvent } from "../../src/events";

describe( "CreateTeamsCommand", () => {
	const mockInput: CreateTeamsInput = {
		data: {
			[ mockTeamA.name ]: [ mockPlayer1.id, mockPlayer3.id ],
			[ mockTeamB.name ]: [ mockPlayer2.id, mockPlayer4.id ]
		}
	};

	const mockGameData = buildMockGameData( GameStatus.PLAYERS_READY );
	const mockPrisma = mockDeep<PrismaService>();
	const mockEventBus = mockDeep<EventBus>();

	it( "should throw error if playerCount is less than required", async () => {
		const handler = new CreateTeamsCommandHandler( mockPrisma, mockEventBus );
		const command = new CreateTeamsCommand( mockInput, { ...mockGameData, playerCount: 6 } );

		expect.assertions( 2 );
		handler.execute( command ).catch( ( err: HttpException ) => {
			expect( err.getStatus() ).toEqual( 400 );
			expect( err.message ).toEqual( Messages.GAME_DOESNT_HAVE_ENOUGH_PLAYERS );
		} );
	} );

	it( "should create teams and assign teams to players", async () => {
		mockPrisma.literature.team.create.mockResolvedValueOnce( mockTeamA ).mockResolvedValueOnce( mockTeamB );
		const handler = new CreateTeamsCommandHandler( mockPrisma, mockEventBus );
		const result = await handler.execute( new CreateTeamsCommand( mockInput, mockGameData ) );

		expect( result ).toEqual( {
			[ mockTeamA.id ]: { ...mockTeamA, members: mockInput.data[ mockTeamA.name ] },
			[ mockTeamB.id ]: { ...mockTeamB, members: mockInput.data[ mockTeamB.name ] }
		} );

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

		expect( mockEventBus.publish ).toHaveBeenCalledTimes( 1 );
		expect( mockEventBus.publish )
			.toHaveBeenCalledWith( new TeamsCreatedEvent( mockGameData.id, result ) );
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockEventBus );
	} );
} );