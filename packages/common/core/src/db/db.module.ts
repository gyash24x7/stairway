import { Module } from "@nestjs/common";
import { DatabaseClient } from "./db.client";
import { ConfigModule } from "../config";

@Module( {
	imports: [ ConfigModule ],
	providers: [ DatabaseClient ],
	exports: [ DatabaseClient ]
} )
export class DatabaseModule {}