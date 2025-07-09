import type { AuthInfo } from "@/auth/types";
import { encodeBase32LowerCaseNoPadding } from "@oslojs/encoding";
import { ulid } from "ulid";
import { type Config, names, uniqueNamesGenerator } from "unique-names-generator";

const namesConfig: Config = {
	dictionaries: [ names ],
	separator: " ",
	length: 1
};

/**
 * Generates a unique identifier using ULID.
 * @returns {string} A unique identifier in ULID format.
 */
export function generateId(): string {
	return ulid();
}

/**
 * Generates a unique name using the unique-names-generator package.
 * @returns {string} A unique name.
 */
export function generateName(): string {
	return uniqueNamesGenerator( namesConfig );
}

/**
 * Generates a random avatar URL using the DiceBear Open Peeps API.
 * @param {string} [seed] - Optional seed for generating a consistent avatar.
 * @returns {string} A URL to a randomly generated avatar image.
 */
export function generateAvatar( seed?: string ): string {
	return `https://api.dicebear.com/7.x/open-peeps/png?seed=${ seed ?? Date.now() }&r=50`;
}

/**
 * Generates a bot information object with a unique ID, name, username, and avatar.
 * @returns {AuthInfo} An object containing bot information.
 */
export function generateBotInfo(): AuthInfo {
	const id = generateId();
	const name = generateName();
	const username = generateId();
	const avatar = generateAvatar();
	return { id, name, username, avatar };
}

/**
 * Generates a session token using a random byte array encoded in Base32.
 * @returns {string} A session token.
 */
export function generateSessionToken(): string {
	const bytes = new Uint8Array( 20 );
	crypto.getRandomValues( bytes );
	return encodeBase32LowerCaseNoPadding( bytes );
}

/**
 * Generates a game code consisting of alphanumeric characters.
 * @param {number} [length=6] - The length of the game code to generate.
 * @returns {string} A randomly generated game code.
 */
export function generateGameCode( length: number = 6 ): string {
	const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	let result = "";
	for ( let i = 0; i < length; i++ ) {
		result += chars[ Math.floor( Math.random() * 36 ) ];
	}
	return result;
}