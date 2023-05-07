export type VariantSet = {
	[ key: string ]: { [ key: string ]: string }
}

export type VariantDefaultValue<V extends VariantSet> = {
	[key in keyof V]: keyof V[key]
};

export type VariantValue<V extends VariantSet> = {
	[key in keyof V]: ( keyof V[key] ) | undefined
};

export class VariantSchema<V extends VariantSet> {
	private readonly baseClasses: string;
	private readonly variantSet: V;
	private readonly defaultVariants: VariantDefaultValue<V>;

	constructor( baseClasses: string, variantSet: V, defaultVariants: VariantDefaultValue<V> ) {
		this.baseClasses = baseClasses;
		this.variantSet = variantSet;
		this.defaultVariants = defaultVariants;
	}

	getClassname( variants?: VariantValue<V> ) {
		let finalClasses = `${ this.baseClasses }`;

		if ( !!variants ) {
			Object.keys( variants ).forEach( key => {
				if ( variants[ key ] === undefined ) {
					delete variants[ key ];
				}
			} );
		}

		const finalVariants = { ...this.defaultVariants, ...variants };

		for ( const variantKey in finalVariants ) {
			const variantValue = finalVariants[ variantKey ];
			const variantDefinition = this.variantSet[ variantKey ];
			finalClasses += ` ${ variantDefinition[ variantValue ] }`;
		}

		return finalClasses;
	}
}