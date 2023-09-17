import { Injectable } from "@nestjs/common";
import type { Collection } from "mongodb";
import { ObjectId } from "mongodb";
import type { IUser } from "@auth/data";
import { User } from "@auth/data";
import { DatabaseClient } from "@s2h/core";
import { DbConstants } from "../constants";

@Injectable()
export class UserService {

	private readonly users: Collection<IUser>;

	constructor( readonly client: DatabaseClient ) {
		this.users = client.db( DbConstants.AUTH_DB ).collection( DbConstants.USERS_COLLECTION );
	}


	async createUser( user: IUser ): Promise<User> {
		const { insertedId } = await this.users.insertOne( user );
		return User.from( insertedId.toHexString(), user );
	}


	async saveUser( user: User ) {
		await this.users.updateOne( { _id: new ObjectId( user.id ) }, user.serialize() );
	}


	async findUserByEmail( email: string ): Promise<User | null> {
		const user = await this.users.findOne( { email } );
		return !!user ? User.from( user._id.toHexString(), user ) : null;
	}


	async findUserByIdAndSalt( id: string, salt: string ): Promise<User | null> {
		const _id = new ObjectId( id );
		const user = await this.users.findOne( { _id, salt } );
		return !!user ? User.from( id, user ) : null;
	}
}