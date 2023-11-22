export interface Type<T = any> extends Function {
	new( ...args: any[] ): T;
}

export interface BusinessValidator<C, R> {
	validate( command: C ): Promise<R>;
}

export interface DataTransformer<I, R> {
	transform( input: I ): R;
}

export class HttpException extends Error {
	private readonly statusCode: number;

	constructor( statusCode: number, message: string ) {
		super( message );
		this.statusCode = statusCode;
	}

	getStatus() {
		return this.statusCode;
	}
}