import { FormEvent, useState } from "react";
import type { ButtonProps } from "../button/index.js";
import { Button } from "../button/index.js";
import { VStack } from "../stack/index.js";
import type { FieldOf, FieldRenderFn, FieldValueOf } from "./field.js";
import { Field } from "./field.js";
import type { ValidatorFn } from "./validations.js";
import { validate } from "./validations.js";

type FieldData<P, V = any> = Record<FieldOf<P>, V>;

type Fields<T> = Array<FieldOf<T>>;

export type CreateFormOptions<T> = {
	initialValue: T;
	onSubmit?: ( values: T ) => void | Promise<void>
}

function buildInitialValues<T extends Object, R>( initialValue: T, initializeWith: R ): FieldData<T, R> {
	const keys = Object.keys( initialValue ) as Array<FieldOf<T>>;
	const initMap = {} as FieldData<T, R>;
	keys.forEach( key => {
		initMap[ key ] = initializeWith;
	} );
	return initMap;
}

export function createForm<T extends Object>( options: CreateFormOptions<T> ) {
	const [ fields ] = useState( Object.keys( options.initialValue ) as Fields<T> );
	const [ values, setValues ] = useState( options.initialValue );
	const [ errors, setErrors ] = useState( buildInitialValues( options.initialValue, "" ) );
	const [ touched, setTouched ] = useState( buildInitialValues( options.initialValue, false ) );

	const getFieldValue = ( name: FieldOf<T> ): FieldValueOf<T, typeof name> => values[ name ];

	const setFieldValue = (
		name: FieldOf<T>,
		validators: Array<ValidatorFn<FieldValueOf<T, typeof name>>> = []
	) => {
		return ( value: FieldValueOf<T, typeof name> ) => {
			setFieldTouched( name, true );

			setValues( values => (
				{ ...values, [ name ]: value }
			) );

			const errMsg = validate( value, validators );

			if ( !!errMsg ) {
				setFieldError( name, errMsg );
			} else {
				setFieldError( name, "" );
			}

		};
	};

	const getFieldError = ( name: FieldOf<T> ) => !!touched[ name ]
		? !!errors[ name ] ? errors[ name ] : "Looks Good!"
		: "";

	const setFieldError = ( name: FieldOf<T>, error: string ) => {
		setErrors( errors => (
			{ ...errors, [ name ]: error }
		) );
	};

	const getFieldTouched = ( name: FieldOf<T> ) => touched[ name ];

	const getFieldAppearance = ( name: FieldOf<T> ) => !!touched[ name ]
		? !!errors[ name ] ? "danger" : "success"
		: "default";

	const setFieldTouched = ( name: FieldOf<T>, value: boolean ) => {
		setTouched( touched => (
			{ ...touched, [ name ]: value }
		) );
	};

	const onSubmit = ( e: FormEvent ) => {
		e.preventDefault();
		if ( options.onSubmit ) {
			options.onSubmit( values );
		}
	};

	return {
		values,
		setFieldValue,
		getFieldError,
		setFieldError,
		fields,
		onSubmit,
		getFieldValue,
		getFieldTouched,
		getFieldAppearance
	};
}

export interface FormProps<T> {
	isLoading?: boolean;
	initialValue: T;
	onSubmit?: ( values: T ) => void | Promise<any>;
	submitBtn?: ( btnProps?: ButtonProps ) => JSX.Element;
	renderMap: Record<FieldOf<T>, FieldRenderFn<T, FieldOf<T>>>;
	validations?: Record<FieldOf<T>, Array<ValidatorFn<FieldValueOf<T, FieldOf<T>>>> | undefined>;
}

const DefaultSubmitBtn = ( props?: ButtonProps ) => {
	return (
		<Button
			appearance={ "primary" }
			buttonText={ "Submit" }
			fullWidth
			{ ...props }
			type={ "submit" }
		/>
	);
};

export function Form<T extends Object>( { validations, isLoading, ...props }: FormProps<T> ) {
	const {
		onSubmit,
		getFieldValue,
		setFieldValue,
		fields,
		getFieldError,
		getFieldTouched,
		getFieldAppearance
	} = createForm<T>( props );

	const SubmitButton = props.submitBtn || DefaultSubmitBtn;

	return (
		<form onSubmit={ onSubmit } noValidate>
			<VStack spacing={ "xl" }>
				{ fields.map( fieldName => (
					<div key={ fieldName.toString() }>
						<Field<T, typeof fieldName>
							name={ fieldName }
							value={ getFieldValue( fieldName ) }
							render={ props.renderMap[ fieldName ] }
							setValue={ setFieldValue( fieldName, validations ? validations[ fieldName ] || [] : [] ) }
							error={ getFieldError( fieldName ) }
							touched={ getFieldTouched( fieldName ) }
							appearance={ getFieldAppearance( fieldName ) }
						/>
					</div>
				) ) }
				<SubmitButton isLoading={ isLoading }/>
			</VStack>
		</form>
	);
}