import { r } from "rethinkdb-ts";

const userData = [
	{
		name: "Swarnava Das",
		email: "swarnava@gmail.com",
		avatar: "https://avatars.dicebear.com/api/micah/bcdjkvbdjkjbdnvkjdbkbvjdk.svg?r=50",
		salt: "bcdjkvbdjkbvjdk"
	},
	{
		name: "Preetam Sekhar",
		email: "preetam@gmail.com",
		avatar: "https://avatars.dicebear.com/api/micah/jkbdjdbchjjhfbjvscbkb.svg?r=50",
		salt: "jkbdjdbchjscbkb"
	},
	{
		name: "Vijayabharathi Murugan",
		email: "bj@gmail.com",
		avatar: "https://avatars.dicebear.com/api/micah/qrrwtgvdhjckskjdnvkjdlkjd.svg?r=50",
		salt: "qrrwtgvdhjckslkjd"
	},
	{
		name: "Pratik Manghwani",
		email: "pratik@gmail.com",
		avatar: "https://avatars.dicebear.com/api/micah/mxnbcnmbwhidvbdkjnkldjxbcj.svg?r=50",
		salt: "mxnbcnmbwhikldjxbcj"
	}
];

async function seed() {
	const connection = await r.connect( { host: "personal.local", port: 28015 } );
	const db = r.db( "stairway" );

	const res = await db.table( "users" ).insert( userData ).run( connection )
		.catch( err => console.log( err ) );

	console.log( res );

	return () => connection.close();
}


seed().catch( err => console.log( err ) ).then( async closeConnection => await closeConnection() );