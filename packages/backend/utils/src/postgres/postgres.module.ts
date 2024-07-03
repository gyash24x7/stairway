import { Global, Module } from "@nestjs/common";
import { PostgresClientFactory } from "./postgres.client.factory.ts";

@Global()
@Module( {
	providers: [ PostgresClientFactory ],
	exports: [ PostgresClientFactory ]
} )
export class PostgresModule {}