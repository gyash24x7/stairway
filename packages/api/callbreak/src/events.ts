import type { Callbreak } from "@stairway/types/callbreak";
import { emitGameEvent } from "@stairway/utils";

export function publishGameEvent<E extends Callbreak.GameEvent>(
	gameId: string,
	event: E,
	data: Callbreak.GameEventPayloads[E]
) {
	emitGameEvent( "callbreak", { gameId, event, data } );
}

export function publishPlayerEvent<E extends Callbreak.PlayerEvent>(
	gameId: string,
	playerId: string,
	event: E,
	data: Callbreak.PlayerEventPayloads[E]
) {
	emitGameEvent( "callbreak", { gameId, playerId, event, data } );
}
