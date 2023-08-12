export type FieldOf<T> = keyof T;

export type FieldValueOf<T, R extends FieldOf<T>> = T[R];

export type FieldRenderFn<T, R extends keyof T> = ( data: Omit<FieldProps<T, R>, "render"> ) => JSX.Element;

export interface FieldProps<T, R extends FieldOf<T>> {
	name: R;
	value: T[R];
	setValue: ( value: T[R] ) => void;
	render: FieldRenderFn<T, R>;
	error?: string;
	touched?: boolean;
	appearance: "default" | "danger" | "success";
}

export function Field<T, R extends FieldOf<T>>( props: FieldProps<T, R> ) {
	return props.render( props );
}
