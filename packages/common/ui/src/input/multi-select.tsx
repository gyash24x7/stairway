import { HStack } from "../stack/index.js";
import { VariantSchema } from "../utils/index.js";
import type { SelectOption } from "./list-select.js";

export interface MultiSelectProps<T> {
	values: SelectOption<T>[];
	onChange: ( v: SelectOption<T>[] ) => void | Promise<void>;
	options: SelectOption<T>[];
	renderOption: ( option: SelectOption<T>, checked: boolean ) => JSX.Element;
}

const radioSelectOptionVS = new VariantSchema(
	"hover:bg-light-300 outline-none cursor-pointer my-2 p-2 rounded-md",
	{ checked: { true: "bg-primary-100 hover:bg-primary-100", false: "" } },
	{ checked: "false" }
);

export function MultiSelect<T>( props: MultiSelectProps<T> ) {
	const handleOptionClick = ( { label, value }: SelectOption<T> ) => () => {
		if ( isChecked( label ) ) {
			const newValues = props.values.filter( option => option.label !== label );
			props.onChange( newValues );
		} else {
			const newValues = [ ...props.values, { label, value } ];
			props.onChange( newValues );
		}
	};

	const isChecked = ( label: string ) => props.values.map( o => o.label ).includes( label );

	const radioSelectOptionClassname = ( checked: boolean ) => {
		return radioSelectOptionVS.getClassname( { checked: checked ? "true" : "false" } );
	};

	return (
		<HStack wrap spacing={ "xs" }>
			{ props.options.map( option => (
				<div
					className={ radioSelectOptionClassname( isChecked( option.label ) ) }
					onClick={ handleOptionClick( option ) }
					key={ option.label }
				>
					{ props.renderOption( option, isChecked( option.label ) ) }
				</div>
			) ) }
		</HStack>
	);
}