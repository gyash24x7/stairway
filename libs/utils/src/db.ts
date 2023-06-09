import { IUser } from "@s2h/utils";
import { Collection } from "mongodb";

export type Db = { users: () => Collection<IUser> };