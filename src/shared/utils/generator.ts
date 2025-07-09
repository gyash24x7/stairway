import { encodeBase32LowerCaseNoPadding } from "@oslojs/encoding";
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

export function generateAvatar( seed?: string ) {
	return `https://api.dicebear.com/7.x/open-peeps/png?seed=${ seed ?? Date.now() }&r=50`;
}

export function generateBotInfo() {
	const id = generateId();
	const name = generateName();
	const username = generateId();
	const avatar = generateAvatar();
	return { id, name, username, avatar };
}

export function generateSessionToken() {
	const bytes = new Uint8Array( 20 );
	crypto.getRandomValues( bytes );
	return encodeBase32LowerCaseNoPadding( bytes );
}

export function generateGameCode( length: number = 6 ) {
	const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	let result = "";
	for ( let i = 0; i < length; i++ ) {
		result += chars[ Math.floor( Math.random() * 36 ) ];
	}
	return result;
}