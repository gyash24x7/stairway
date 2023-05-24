import { ILiteratureGame } from "@s2h/literature/utils";
import { IUser } from "@s2h/utils";
import { r } from "rethinkdb-ts";

const LITERATURE_TABLE = "literature";
const USERS_TABLE = "users";

export const db = {
	...r,
	literature: () => r.table<ILiteratureGame>( LITERATURE_TABLE ),
	users: () => r.table<IUser>( USERS_TABLE ),
	connect: () => r.connect( { host: "personal.local", port: 28015 } )
};