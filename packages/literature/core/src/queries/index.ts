import { CardsDataQueryHandler } from "./cards.data.query";
import { GameDataQueryHandler } from "./game.data.query";
import { InferenceDataQueryHandler } from "./inference.data.query";
import { PlayerSpecificDataQueryHandler } from "./player.specific.data.query";

export * from "./game.data.query";
export * from "./player.specific.data.query";
export * from "./cards.data.query";
export * from "./inference.data.query";

export const queryHandlers = [
	GameDataQueryHandler,
	PlayerSpecificDataQueryHandler,
	CardsDataQueryHandler,
	InferenceDataQueryHandler
];