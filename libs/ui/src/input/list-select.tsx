import { Combobox, Transition } from "@headlessui/react";
import { Fragment, useState } from "react";
import { CheckCircleIcon, SelectorIcon } from "@heroicons/react/solid";
import { InputMessage } from "./input-message";
import { VariantSchema } from "../utils/variant";

export type SelectOption<T = any> = { label: string, value: T };

export interface ListSelectProps<T = any> {
	name: string;
	options: SelectOption<T>[],
	label?: string;
	placeholder?: string;
	value?: SelectOption<T>;
	onChange: ( value: SelectOption ) => void | Promise<void>;
	appearance?: "default" | "success" | "danger"
	message?: string;
}

const optionVS = new VariantSchema(
	"cursor-default select-none relative py-2 pl-10 pr-4 text-dark",
	{ active: { true: "text-primary bg-primary-100", false: "" } },
	{ active: "false" }
);

const optionIconVS = new VariantSchema(
	"absolute inset-y-0 left-0 flex items-center pl-3 text-dark",
	{ active: { true: "text-primary", false: "" } },
	{ active: "false" }
);

export function ListSelect( props: ListSelectProps ) {
	const { options, label, name, message, appearance, placeholder, value, onChange } = props;
	const [ query, setQuery ] = useState( "" );

	const filteredOptions = query === "" ? options : options.filter(
		( option ) => option.label.toLowerCase().includes( query.toLowerCase() )
	);

	const optionClassname = ( { active }: { active: boolean } ) => {
		return optionVS.getClassname( { active: active ? "true" : "false" } );
	};

	const optionIconClassname = ( { active }: { active: boolean } ) => {
		return optionIconVS.getClassname( { active: active ? "true" : "false" } );
	};

	return (
		<div className = { "w-full" }>
			<Combobox value = { value || options[ 0 ] } onChange = { onChange }>
				{ label && (
					<label className = { "text-sm text-dark-100 font-semibold" } htmlFor = { name }>{ label }</label>
				) }
				<div
					className = {
						"flex w-full text-left rounded-md cursor-default"
						+ "focus:outline-none focus-visible:ring-0 overflow-hidden "
						+ "border-2 border-light-700 text-dark p-2 text-base"
					}
				>
					<Combobox.Input
						displayValue = { ( option: SelectOption ) => option.label }
						onChange = { ( event ) => setQuery( event.target.value ) }
						placeholder = { placeholder }
						className = { "w-full border-none focus:outline-none text-base leading-5 text-dark" }
					/>
					<Combobox.Button className = { "w-5 h-5 text-light-700" }>
						<SelectorIcon aria-hidden = "true"/>
					</Combobox.Button>
				</div>
				<Transition
					as = { Fragment }
					leave = { "transition ease-in duration-100" }
					leaveFrom = { "opacity-100" }
					leaveTo = { "opacity-0" }
				>
					<Combobox.Options
						className = {
							"absolute w-full py-1 mt-1 bg-light-100 rounded-md "
							+ "border border-light-700 max-h-60 text-base"
						}
					>
						{ filteredOptions.length === 0 && query !== ""
							? (
								<div className = { "cursor-default select-none relative py-2 px-4 text-dark" }>
									Nothing found.
								</div>
							)
							: filteredOptions.map( ( option ) => (
								<Combobox.Option key = { option.label }
												 className = { optionClassname }
												 value = { option }>
									{ ( { selected, active } ) => (
										<Fragment>
											<span className = { "block truncate" }>{ option.label }</span>
											{ selected && (
												<span className = { optionIconClassname( { active } ) }>
													<CheckCircleIcon className = { "w-4 h-4" } aria-hidden = "true"/>
												</span>
											) }
										</Fragment>
									) }
								</Combobox.Option>
							) )
						}
					</Combobox.Options>
				</Transition>
				{ message && <InputMessage text = { message } appearance = { appearance }/> }
			</Combobox>
		</div>
	);
}