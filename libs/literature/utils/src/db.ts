import { db as baseDb } from "@s2h/utils";
import { ILiteratureGame } from "./game";

export const LITERATURE_TABLE = "literature";

export const db = {
	...baseDb,
	literature: () => baseDb.table<ILiteratureGame>( LITERATURE_TABLE )
};

export type Db = typeof db;