import * as schema from "./auth.schema.ts";

export type User = typeof schema.users.$inferSelect;

export type Token = typeof schema.tokens.$inferSelect;
