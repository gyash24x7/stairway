import { Injectable } from "@nestjs/common";
import postgres, { type Sql } from "postgres";

export type PostgresClient = Sql;

@Injectable()
export class PostgresClientFactory {

	private readonly postgresClient: PostgresClient;

	constructor() {
		const connectionString = Bun.env[ "DATABASE_URL" ]!;
		this.postgresClient = postgres( connectionString );
	}

	get() {
		return this.postgresClient;
	}
}