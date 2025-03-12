import type { Literature } from "@stairway/types/literature";
import { emitGameEvent } from "@stairway/utils";

export function publishGameEvent<E extends Literature.GameEvent>(
	gameId: string,
	event: E,
	data: Literature.GameEventPayloads[E]
) {
	emitGameEvent( "literature", { gameId, event, data } );
}

export function publishPlayerEvent<E extends Literature.PlayerEvent>(
	gameId: string,
	playerId: string,
	event: E,
	data: Literature.PlayerEventPayloads[E]
) {
	emitGameEvent( "literature", { gameId, playerId, event, data } );
}

