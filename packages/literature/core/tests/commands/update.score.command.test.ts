import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import type { PrismaService } from "@s2h/core";
import type { EventBus } from "@nestjs/cqrs";
import { UpdateScoreCommand, UpdateScoreCommandHandler } from "../../src/commands";
import { buildMockGameData, mockAskMove, mockCallMove, mockTeamA, mockTeamB } from "../mockdata";
import { GameStatus } from "@literature/types";
import { CardSet } from "@s2h/cards";
import { ScoreUpdatedEvent } from "../../src/events";

describe( "UpdateScoreCommand", () => {

	const mockPrisma = mockDeep<PrismaService>();
	const mockEventBus = mockDeep<EventBus>();
	const mockGameData = buildMockGameData( GameStatus.IN_PROGRESS );

	it( "should not update score if currentMove is not valid", async () => {
		const handler = new UpdateScoreCommandHandler( mockPrisma, mockEventBus );
		const command = new UpdateScoreCommand( mockAskMove, mockGameData.players, mockGameData.teams );

		const scoreUpdate = await handler.execute( command );

		expect( scoreUpdate ).toBeUndefined();
	} );

	it( "should update score of opposing team if currentMove is not successful", async () => {
		mockPrisma.literature.team.update.mockResolvedValue( { ...mockTeamB, score: 1 } );
		const handler = new UpdateScoreCommandHandler( mockPrisma, mockEventBus );
		const command = new UpdateScoreCommand(
			{ ...mockCallMove, success: false },
			mockGameData.players,
			mockGameData.teams
		);

		const scoreUpdate = await handler.execute( command );

		expect( scoreUpdate?.teamId ).toEqual( mockTeamB.id );
		expect( scoreUpdate?.score ).toEqual( 1 );
		expect( scoreUpdate?.setWon ).toEqual( CardSet.LOWER_CLUBS );

		expect( mockPrisma.literature.team.update ).toHaveBeenCalledWith( {
			where: { id: mockTeamB.id },
			data: {
				score: { increment: 1 },
				setsWon: { push: CardSet.LOWER_CLUBS }
			}
		} );

		const event = new ScoreUpdatedEvent( mockGameData.id, mockGameData.teams, scoreUpdate! );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( event );
	} );

	it( "should update score of the team if currentMove is successful", async () => {
		mockPrisma.literature.team.update.mockResolvedValue( { ...mockTeamA, score: 4 } );
		const handler = new UpdateScoreCommandHandler( mockPrisma, mockEventBus );
		const command = new UpdateScoreCommand( mockCallMove, mockGameData.players, mockGameData.teams );

		const scoreUpdate = await handler.execute( command );

		expect( scoreUpdate?.teamId ).toEqual( mockTeamA.id );
		expect( scoreUpdate?.score ).toEqual( 4 );
		expect( scoreUpdate?.setWon ).toEqual( CardSet.LOWER_CLUBS );

		expect( mockPrisma.literature.team.update ).toHaveBeenCalledWith( {
			where: { id: mockTeamA.id },
			data: {
				score: { increment: 1 },
				setsWon: { push: CardSet.LOWER_CLUBS }
			}
		} );

		const event = new ScoreUpdatedEvent( mockGameData.id, mockGameData.teams, scoreUpdate! );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( event );
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockEventBus );
	} );

} );