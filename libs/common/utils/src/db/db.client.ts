import { Injectable } from "@nestjs/common";
import { MongoClient } from "mongodb";
import { type AppConfig, Config } from "../config";

@Injectable()
export class DatabaseClient extends MongoClient {
	constructor( @Config() private readonly config: AppConfig ) {
		super( config.db.url );
	}
}
