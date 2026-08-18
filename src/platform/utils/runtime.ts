import * as Alchemy from "alchemy";
import * as Effect from "effect/Effect";

export const withRuntime = <A, E, R>(
	effect: Effect.Effect<A, E, R | Alchemy.RuntimeContext>
) => effect.pipe( Effect.provide( Alchemy.RuntimeContext.phantom ) );
