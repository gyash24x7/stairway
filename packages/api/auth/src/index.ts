export * from "./oauth.ts";
export * from "./lucia.ts";

export type UserAuthInfo = {
	id: string;
	name: string;
	avatar: string;
}