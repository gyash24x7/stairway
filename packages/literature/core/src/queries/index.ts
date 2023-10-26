import { CardMappingsQueryHandler } from "./card.mappings.query";
import { GameDataQueryHandler } from "./game.data.query";
import { PlayerSpecificDataQueryHandler } from "./player.specific.data.query";

export * from "./game.data.query";
export * from "./player.specific.data.query";
export * from "./card.mappings.query";

export const queryHandlers = [
	GameDataQueryHandler,
	PlayerSpecificDataQueryHandler,
	CardMappingsQueryHandler
];