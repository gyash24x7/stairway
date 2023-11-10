export interface DataTransformer<I, R> {
	transform( input: I ): R;
}