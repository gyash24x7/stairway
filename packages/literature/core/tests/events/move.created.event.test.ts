import { test } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import type { Move } from "@literature/data";
import { MoveCreatedEvent, MoveCreatedEventHandler } from "../../src/events";

test( "MoveCreatedEventHandler should handle the created move", async () => {
	const mockMove = mockDeep<Move>();
	const handler = new MoveCreatedEventHandler();
	handler.handle( new MoveCreatedEvent( mockMove ) );
} );