import "dotenv/config";
import path from "node:path";
import process from "node:process";

export default {
	earlyAccess: true,
	schema: {
		kind: "multi",
		folderPath: path.join( process.cwd(), "src", "schema" )
	}
};