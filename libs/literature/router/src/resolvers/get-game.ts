import type { GetGameInput } from "@s2h/literature/dtos";
import type { ILiteratureGame } from "@s2h/literature/utils";
import type { LitResolver } from "../utils";

export function getGame(): LitResolver<GetGameInput, ILiteratureGame> {
	return async ( { ctx } ) => ctx.currentGame!;
}