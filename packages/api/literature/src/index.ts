import type { LiteratureRouter } from "./literature.router.ts";

export type Router = ReturnType<LiteratureRouter["router"]>;
export type * from "./literature.types.ts";
export type * from "./literature.inputs.ts";

export * from "./literature.module.ts";