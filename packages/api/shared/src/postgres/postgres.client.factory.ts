import { Injectable } from "@nestjs/common";
import * as process from "node:process";
import postgres, { type Sql } from "postgres";

export type PostgresClient = Sql;

@Injectable()
export class PostgresClientFactory {

	private readonly postgresClient: PostgresClient;

	constructor() {
		const connectionString = process.env[ "DATABASE_URL" ]!;
		this.postgresClient = postgres( connectionString );
	}

	get() {
		return this.postgresClient;
	}
}