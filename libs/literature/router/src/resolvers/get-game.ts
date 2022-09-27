import type { LitResolverOptions } from "../types";
import type { GetGameInput } from "@s2h/literature/dtos";
import type { IEnhancedLitGame } from "@s2h/literature/utils";

export default async function ( { ctx }: LitResolverOptions<GetGameInput> ): Promise<IEnhancedLitGame> {
    return ctx.currentGame!
};