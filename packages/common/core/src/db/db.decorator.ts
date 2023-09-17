import { Inject } from "@nestjs/common";
import type { DatabaseClient } from "./db.client";

export type DbFn<T> = ( client: DatabaseClient ) => T
export const DATABASE = "Database";

export const Database = () => Inject( DATABASE );