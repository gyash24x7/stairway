import type { LitResolver } from "../types";
import type { GetGameInput } from "@s2h/literature/dtos";
import type { EnhancedLitGame } from "@s2h/literature/utils";

const getGameResolver: LitResolver<GetGameInput> = async ( { ctx } ) => {
	const game: EnhancedLitGame = ctx.res?.locals[ "currentGame" ];
	return game;
};

export default getGameResolver;