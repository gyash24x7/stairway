import type { GetGameInput } from "@s2h/literature/dtos";
import type { ILiteratureGame } from "@s2h/literature/utils";
import type { LitResolverOptions } from "../types";

export async function getGame( { ctx }: LitResolverOptions<GetGameInput> ): Promise<ILiteratureGame> {
	return ctx.currentGame!;
}