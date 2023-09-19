export function requiredValidator( msg: string ) {
	return ( value: string ) => !value ? msg : undefined;
}

export function patternValidator( regex: RegExp, msg: string ) {
	return ( value: string ) => !regex.test( value as string ) ? msg : undefined;
}

export function minLengthValidator( minLength: number, msg: string ) {
	return ( value: string ) => value.length > minLength ? undefined : msg;
}

export function emailValidator( msg: string ) {
	const emailRegex = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;
	return patternValidator( emailRegex, msg );
}