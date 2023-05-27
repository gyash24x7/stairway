import { IUser } from "@s2h/utils";
import { r } from "rethinkdb-ts";

const USERS_TABLE = "users";

export const db = {
	...r,
	users: () => r.table<IUser>( USERS_TABLE ),
	connect: () => r.connect( { host: "personal.local", port: 28015 } )
};

export type Db = typeof db;