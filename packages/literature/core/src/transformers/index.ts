import { CardsDataTransformer } from "./cards.data.transformer";
import { GameDataTransformer } from "./game.data.transformer";

export * from "./game.data.transformer";
export * from "./cards.data.transformer";

export const transformers = [
	GameDataTransformer,
	CardsDataTransformer
];