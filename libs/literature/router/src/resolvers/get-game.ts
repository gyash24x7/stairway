import type { LitResolverOptions } from "../types";
import type { GetGameInput } from "@s2h/literature/dtos";

export default async function ( { ctx }: LitResolverOptions<GetGameInput> ) {
	return ctx.currentGame!
};