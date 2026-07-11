"use client";

import { cn } from "@s2h/ui/utils/cn";
import type { ReactNode } from "react";

export type RadioSelectProps<T> = {
	options: readonly T[];
	value: T | undefined;
	onChange: ( value: T | undefined ) => void;
	renderOption?: ( option: T, isSelected: boolean ) => ReactNode;
	isDisabled?: ( option: T ) => boolean;
	allowDeselect?: boolean;
	className?: string;
};

export function RadioSelect<T>( props: RadioSelectProps<T> ) {
	const allowDeselect = props.allowDeselect ?? true;
	const renderOption = props.renderOption ?? ( ( opt: T ) => String( opt ) );

	const handleClick = ( option: T ) => {
		if ( props.value === option ) {
			if ( allowDeselect ) {
				props.onChange( undefined );
			}
		} else {
			props.onChange( option );
		}
	};

	return (
		<div className={ cn( "flex gap-3 flex-wrap", props.className ) }>
			{ props.options.map( ( option, index ) => {
				const isSelected = props.value === option;
				const isDisabled = props.isDisabled?.( option ) ?? false;
				return (
					<div
						key={ `radio-option-${ index }` }
						onClick={ () => !isDisabled && handleClick( option ) }
						className={ cn(
							"rounded-md border flex justify-center p-1 md:p-2",
							"bg-background border-inverted-surface min-w-20 md:min-w-30",
							!isDisabled && "cursor-pointer",
							isSelected && "border-accent bg-accent/20",
							isDisabled && "opacity-50 cursor-not-allowed"
						) }
					>
						{ renderOption( option, isSelected ) }
					</div>
				);
			} ) }
		</div>
	);
}
