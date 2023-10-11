import { PrismaClient } from "@prisma/client";
import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { type AppConfig, Config } from "../config";

@Injectable()
export class BasePrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {

	constructor( @Config() readonly config: AppConfig ) {
		super( {
			datasources: {
				db: {
					url: config.db.url
				}
			}
		} );
	}

	async onModuleInit() {
		super.$connect();
	}

	async onModuleDestroy() {
		super.$disconnect();
	}
}
