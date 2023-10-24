import { GameDataQueryHandler } from "./game.data.query";
import { PlayerDataQueryHandler } from "./player.data.query";
import { CardMappingsQueryHandler } from "./card.mappings.query";

export * from "./game.data.query";
export * from "./player.data.query";
export * from "./card.mappings.query";

export const queryHandlers = [
	GameDataQueryHandler,
	PlayerDataQueryHandler,
	CardMappingsQueryHandler
];