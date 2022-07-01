export * from "./enhanced-game";
export * from "./enhanced-player";
export * from "./enhanced-move";
export * from "./enhanced-team";

export function generateGameCode() {
	const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	let result = "";
	for ( let i = 0; i < 6; i++ ) {
		result += chars[ Math.floor( Math.random() * 36 ) ];
	}
	return result;
}