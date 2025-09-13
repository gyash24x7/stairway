import {
	type BaseIssue,
	type BaseSchema,
	custom,
	minLength,
	object,
	optional,
	pipe,
	string,
	trim,
	ulid
} from "valibot";

export const ulidSchema = () => pipe( string(), trim(), ulid() );

export const usernameSchema = () => pipe( string(), trim(), minLength( 3 ) );

export const gameIdSchema = () => object( { gameId: ulidSchema() } );

export const customSchema = <T>() => custom<T>( () => true );

type AnySchema = BaseSchema<unknown, unknown, BaseIssue<unknown>>;
export const dataResponseSchema = <T extends AnySchema>( schema: T ) => object( {
	data: optional( schema ),
	error: optional( string() )
} );

export const errorResponseSchema = () => object( { error: optional( string() ) } );