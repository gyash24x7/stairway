import { DynamicModule, Global, Module } from "@nestjs/common";
import { DatabaseClient } from "./db.client";
import { ConfigModule } from "../config";
import { DATABASE, DbFn } from "./db.decorator";

@Global()
@Module( {} )
export class DatabaseModule {
	static register<T>( dbFn: DbFn<T> ): DynamicModule {
		return {
			global: true,
			imports: [ ConfigModule ],
			module: DatabaseModule,
			providers: [ DatabaseClient, { provide: DATABASE, inject: [ DatabaseClient ], useFactory: dbFn } ],
			exports: [ DatabaseClient, DATABASE ]
		};
	}
}