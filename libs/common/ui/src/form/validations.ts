export type ValidatorFn<T> = ( value: T ) => string | undefined;

export function requiredValidator( msg: string ) {
	return ( value: string ) => !value ? msg : undefined;
}

export function patternValidator( regex: RegExp, msg: string ): ValidatorFn<string> {
	return ( value: string ) => !regex.test( value as string ) ? msg : undefined;
}

export function minLengthValidator( minLength: number, msg: string ): ValidatorFn<string> {
	return ( value: string ) => value.length > minLength ? undefined : msg;
}

export function emailValidator( msg: string ): ValidatorFn<string> {
	const emailRegex = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;
	return ( value: string ) => !emailRegex.test( value ) ? msg : undefined;
}

export function mobileValidator( msg: string ): ValidatorFn<string> {
	const digitsRegex = /^\d+$/;
	return ( value: string ) => value.length === 10 && digitsRegex.test( value ) ? undefined : msg;
}

export function rollNumberValidator( msg: string ) {
	const rollNumberRegex = /^[A-Z]{2}[0-9]{2}[A-Z][0-9]{3}$/;
	return patternValidator( rollNumberRegex, msg );
}

export function validate<T>( value: T, validators: Array<ValidatorFn<T>> ) {
	for ( const validator of validators ) {
		const msg = validator( value );
		console.log( !!msg );
		if ( !!msg ) {
			return msg;
		}
	}
	return;
}