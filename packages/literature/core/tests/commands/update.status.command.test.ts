import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import type { PrismaService } from "@s2h/core";
import type { EventBus } from "@nestjs/cqrs";
import { UpdateStatusCommand, UpdateStatusCommandHandler } from "../../src/commands";
import { GameStatus } from "@literature/types";
import { StatusUpdatedEvent } from "../../src/events";

describe( "UpdateStatusCommand", () => {

	const mockPrisma = mockDeep<PrismaService>();
	const mockEventBus = mockDeep<EventBus>();

	it( "should update game status and publish StatusUpdatedEvent", async () => {
		const handler = new UpdateStatusCommandHandler( mockPrisma, mockEventBus );
		const command = new UpdateStatusCommand( "1", GameStatus.TEAMS_CREATED );

		await handler.execute( command );

		expect( mockPrisma.literature.game.update ).toHaveBeenCalledTimes( 1 );
		expect( mockPrisma.literature.game.update ).toHaveBeenCalledWith( {
			where: { id: "1" },
			data: { status: GameStatus.TEAMS_CREATED }
		} );

		expect( mockEventBus.publish ).toHaveBeenCalledTimes( 1 );
		const event = new StatusUpdatedEvent( "1", GameStatus.TEAMS_CREATED );
		expect( mockEventBus.publish ).toHaveBeenCalledWith( event );
	} );

	afterEach( () => {
		mockClear( mockPrisma );
		mockClear( mockEventBus );
	} );
} );