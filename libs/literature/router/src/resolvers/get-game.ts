import type { GetGameInput } from "@s2h/literature/dtos";
import type { ILiteratureGame } from "@s2h/literature/utils";
import type { LiteratureResolver } from "../utils";

export function getGame(): LiteratureResolver<GetGameInput, ILiteratureGame> {
	return async ( { ctx } ) => ctx.currentGame!;
}