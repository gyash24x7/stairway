import type { StandardSchemaV1 } from "@standard-schema/spec";

export const validate = ( schema: StandardSchemaV1 ) => {
	return async ( { args }: any ) => {
		const result = await schema[ "~standard" ].validate( args[ 0 ] );
		if ( result.issues ) {
			throw new Response( null, { status: 400 } );
		}
	};
};