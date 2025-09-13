import { generateAvatar, generateId } from "@/utils/generator";
import { customSchema, usernameSchema } from "@/utils/schema";
import type {
	AuthenticationResponseJSON,
	PublicKeyCredentialCreationOptionsJSON,
	PublicKeyCredentialRequestOptionsJSON,
	RegistrationResponseJSON
} from "@simplewebauthn/server";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { type InferInput, intersect, object, optional, string } from "valibot";

export type User = typeof users.$inferSelect;
export const users = sqliteTable( "auth_users", {
	id: text().notNull().primaryKey().$default( () => generateId() ),
	name: text().notNull(),
	username: text().notNull().unique(),
	avatar: text().notNull().$default( () => generateAvatar() )
} );

export type Passkey = typeof passkeys.$inferSelect;
export const passkeys = sqliteTable( "auth_passkeys", {
	id: text().notNull().primaryKey().$default( () => generateId() ),
	publicKey: text( { mode: "json" } ).notNull().$type<Uint8Array<ArrayBufferLike>>(),
	webauthnUserId: text().notNull(),
	counter: integer().notNull(),
	createdAt: integer().notNull().$default( () => Date.now() ),
	userId: text().notNull().references( () => users.id )
} );

export type WebauthnOptions = InferInput<typeof webauthnOptionsSchema>;
export const webauthnOptionsSchema = object( {
	webauthnUserId: optional( string() ),
	challenge: string()
} );

export type AuthInfo = InferInput<typeof authInfoSchema>;
export const authInfoSchema = object( {
	id: string(),
	name: string(),
	username: string(),
	avatar: string()
} );

export type GetAuthOptionsInput = InferInput<typeof getAuthOptionsInputSchema>;
export const getAuthOptionsInputSchema = object( {
	username: usernameSchema(),
	name: optional( string() )
} );

export type LoginOptions = InferInput<typeof loginOptionsSchema>;
export const loginOptionsSchema = customSchema<PublicKeyCredentialRequestOptionsJSON>();

export type RegistrationOptions = InferInput<typeof registrationOptionsSchema>;
export const registrationOptionsSchema = customSchema<PublicKeyCredentialCreationOptionsJSON>();

export type VerifyLoginInput = InferInput<typeof verifyLoginInputSchema>;
export const verifyLoginInputSchema = intersect( [
	getAuthOptionsInputSchema,
	object( { response: customSchema<AuthenticationResponseJSON>() } )
] );

export type VerifyRegistrationInput = InferInput<typeof verifyRegistrationInputSchema>;
export const verifyRegistrationInputSchema = intersect( [
	getAuthOptionsInputSchema,
	object( { name: string(), response: customSchema<RegistrationResponseJSON>() } )
] );
