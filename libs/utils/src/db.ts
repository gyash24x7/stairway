import { IUser } from "@s2h/utils";
import { RTable } from "rethinkdb-ts";

export type Db = { users: () => RTable<IUser> };