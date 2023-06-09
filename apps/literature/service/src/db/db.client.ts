import { Injectable } from "@nestjs/common";
import { MongoClient } from "mongodb";

@Injectable()
export class DatabaseClient extends MongoClient {
	constructor() {
		super( "mongodb://localhost:27017/stairway" );
	}
}
