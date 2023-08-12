import { RadioGroup } from "@headlessui/react";
import { HStack } from "../stack/index.js";
import { VariantSchema } from "../utils/index.js";

export interface SingleSelectProps<T> {
	value: T;
	onChange: ( value: T ) => void;
	options: Array<T>;
	renderOption: ( option: T, checked: boolean ) => JSX.Element;
}

const radioSelectOptionVS = new VariantSchema(
	"hover:bg-light-300 outline-none cursor-pointer my-2 p-2 rounded-md",
	{ checked: { true: "bg-primary-100 hover:bg-primary-100", false: "" } },
	{ checked: "false" }
);

const radioSelectOptionClassname = ( checked: boolean ) => {
	return radioSelectOptionVS.getClassname( { checked: checked ? "true" : "false" } );
};

export function SingleSelect<T>( props: SingleSelectProps<T> ) {
	return (
		<RadioGroup<"div", T> value={ props.value } onChange={ props.onChange }>
			<HStack wrap spacing={ "xs" }>
				{ props.options.map( ( option, index ) => (
					<RadioGroup.Option
						value={ option }
						className={ ( { checked } ) => radioSelectOptionClassname( checked ) }
						key={ index }
					>
						{ ( { checked } ) => props.renderOption( option, checked ) }
					</RadioGroup.Option>
				) ) }
			</HStack>
		</RadioGroup>
	);
}