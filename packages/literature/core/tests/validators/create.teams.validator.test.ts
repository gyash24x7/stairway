import { CreateTeamsInput, GameStatus } from "@literature/types";
import type { HttpException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { CreateTeamsCommand } from "../../src/commands";
import { Messages } from "../../src/constants/literature.constants";
import { CreateTeamsValidator } from "../../src/validators";
import {
	buildMockGameData,
	mockPlayer1,
	mockPlayer2,
	mockPlayer3,
	mockPlayer4,
	mockTeamA,
	mockTeamB
} from "../mockdata";

describe( "CreateTeamsValidator", () => {

	const mockInput: CreateTeamsInput = {
		data: {
			[ mockTeamA.name ]: [ mockPlayer1.id, mockPlayer3.id ],
			[ mockTeamB.name ]: [ mockPlayer2.id, mockPlayer4.id ]
		}
	};

	const mockGameData = buildMockGameData( GameStatus.PLAYERS_READY );

	it( "should throw error if playerCount is less than required", async () => {
		const handler = new CreateTeamsValidator();
		const command = new CreateTeamsCommand( mockInput, { ...mockGameData, playerCount: 6 } );

		expect.assertions( 2 );
		handler.validate( command ).catch( ( err: HttpException ) => {
			expect( err.getStatus() ).toEqual( 400 );
			expect( err.message ).toEqual( Messages.GAME_DOESNT_HAVE_ENOUGH_PLAYERS );
		} );
	} );

	it( "should do nothing if valid", async () => {
		const handler = new CreateTeamsValidator();
		const command = new CreateTeamsCommand( mockInput, mockGameData );

		expect.assertions( 0 );
		await handler.validate( command );
	} );
} );