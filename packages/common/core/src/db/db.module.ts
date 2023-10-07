import { Module } from "@nestjs/common";
import { DatabaseClient } from "./db.client";
import { ConfigModule } from "../config";
import { BasePrismaService } from "./prisma.service";

@Module( {
	imports: [ ConfigModule ],
	providers: [ DatabaseClient, BasePrismaService ],
	exports: [ DatabaseClient, BasePrismaService ]
} )
export class DatabaseModule {}
