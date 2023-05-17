import {r} from "rethinkdb-ts";

async function setupTables() {
    const connection = await r.connect({host: "personal.local", port: 28015});
    await r.dbCreate("stairway");
    const db = r.db("stairway");

    await db.tableCreate("users").run(connection)
        .catch(err => console.log("Some Error!"));

    await db.tableCreate("literature").run(connection)
        .catch(err => console.log("Some Error!: ", err));

    return () => connection.close();
}

setupTables().catch(err => console.log(err)).then(async closeConnection => await closeConnection());