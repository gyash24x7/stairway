import { MoveCreatedEventHandler } from "./move.created.event";
import { GameStartedEventHandler } from "./game.started.event";
import { HandsUpdatedEventHandler } from "./hands.updated.event";
import { InferencesUpdatedEvent } from "./inferences.updated.event";
import { PlayerJoinedEventHandler } from "./player.joined.event";
import { ScoreUpdatedEventHandler } from "./score.updated.event";
import { StatusUpdatedEventHandler } from "./status.updated.event";
import { TeamsCreatedEventHandler } from "./teams.created.event";
import { TurnUpdatedEventHandler } from "./turn.updated.event";

export * from "./game.started.event";
export * from "./hands.updated.event";
export * from "./inferences.updated.event";
export * from "./move.created.event";
export * from "./player.joined.event";
export * from "./score.updated.event";
export * from "./status.updated.event";
export * from "./teams.created.event";
export * from "./turn.updated.event";

export const eventHandlers = [
	GameStartedEventHandler,
	HandsUpdatedEventHandler,
	InferencesUpdatedEvent,
	MoveCreatedEventHandler,
	PlayerJoinedEventHandler,
	ScoreUpdatedEventHandler,
	StatusUpdatedEventHandler,
	TeamsCreatedEventHandler,
	TurnUpdatedEventHandler
];
