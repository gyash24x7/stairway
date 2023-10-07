import { PlayerSpecificGameQueryHandler } from "./player.specific.game.query";
import { AggregatedGameQueryHandler } from "./aggregated.game.query";

export * from "./aggregated.game.query";
export * from "./player.specific.game.query";

export const queryHandlers = [ PlayerSpecificGameQueryHandler, AggregatedGameQueryHandler ];