import { GameUpdateEventHandler } from "./game.update.event";
import { MoveCreatedEventHandler } from "./move.created.event";

export * from "./game.update.event";
export * from "./move.created.event";

export const eventHandlers = [ GameUpdateEventHandler, MoveCreatedEventHandler ];
