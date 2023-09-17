import superagent from "superagent";

const BASE_URL = "http://localhost:8000/api";

async function request<I extends Object, R>( method: "POST" | "GET" | "PUT", path: string, data?: I ): Promise<R> {
	let req: superagent.SuperAgentRequest;

	switch ( method ) {
		case "GET":
			req = superagent.get( BASE_URL + path ).withCredentials();
			break;

		case "PUT":
			req = superagent.put( BASE_URL + path ).withCredentials().send( data );
			break;

		case "POST":
			req = superagent.post( BASE_URL + path ).withCredentials().send( data );
			break;
	}

	return req.then( res => res.body );
}

export const getRequest = <R>( path: string ) => request<any, R>( "GET", path );
export const postRequest = <I extends Object, R>( path: string, data: I ) => request<I, R>( "POST", path, data );
export const putRequest = <I extends Object, R>( path: string, data: I ) => request<I, R>( "PUT", path, data );

export type OpOps<R> = {
	onSuccess?: ( data: R ) => void;
	onError?: () => void;
}