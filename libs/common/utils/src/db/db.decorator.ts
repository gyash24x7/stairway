import { Inject } from "@nestjs/common";
import { DatabaseClient } from "./db.client";

export type DbFn<T> = ( client: DatabaseClient ) => T
export const DATABASE = "Database";

export const Database = () => Inject( DATABASE );