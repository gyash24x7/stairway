import type { users } from "../schema/auth.schema";
import type { cardMappings, games, moves, players, teams } from "../schema/literature.schema";

export type User = typeof users.$inferSelect;

export type Player = typeof players.$inferSelect;

export type Team = typeof teams.$inferSelect;

export type Game = typeof games.$inferSelect;

export type CardMapping = typeof cardMappings.$inferSelect;

export type Move = typeof moves.$inferSelect;
