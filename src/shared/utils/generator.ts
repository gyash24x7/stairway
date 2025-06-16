import { ulid } from "ulid";
import { type Config, names, uniqueNamesGenerator } from "unique-names-generator";

const namesConfig: Config = {
	dictionaries: [ names ],
	separator: " ",
	length: 1
};

export function generateId() {
	return ulid();
}

export function generateName() {
	return uniqueNamesGenerator( namesConfig );
}

export function generateAvatar() {
	return `https://api.dicebear.com/7.x/open-peeps/png?seed=${ Date.now() }&r=50`;
}

export function generateGameCode() {
	const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	let result = "";
	for ( let i = 0; i < 6; i++ ) {
		result += chars[ Math.floor( Math.random() * 36 ) ];
	}
	return result;
}