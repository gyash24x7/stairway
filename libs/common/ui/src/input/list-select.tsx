import { Listbox, Transition } from "@headlessui/react";
import { CheckCircleIcon, ChevronUpDownIcon } from "@heroicons/react/24/solid";
import { Fragment } from "react";
import { When } from "react-if";
import { VariantSchema } from "../utils/index.js";
import { InputMessage } from "./input-message.js";

export type SelectOption<T = any> = { label: string, value: T };

export interface ListSelectProps<T = any> {
	name: string;
	options: SelectOption<T>[],
	label?: string;
	placeholder?: string;
	value?: SelectOption<T>;
	onChange: ( value: SelectOption<T> ) => void;
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

interface ListSelectOptionProps<T> {
	option: SelectOption<T>;
}

function ListSelectOption<T>( { option }: ListSelectOptionProps<T> ) {
	const optionClassname = ( active: boolean ) => {
		return optionVS.getClassname( { active: active ? "true" : "false" } );
	};

	const optionIconClassname = ( active: boolean ) => {
		return optionIconVS.getClassname( { active: active ? "true" : "false" } );
	};

	return (
		<Listbox.Option value={ option }>
			{ ( { selected, active } ) => (
				<div className={ optionClassname( active ) }>
					<span className={ "block truncate" }>{ option.label }</span>
					<When condition={ selected }>
						<span className={ optionIconClassname( active ) }>
							<CheckCircleIcon className={ "w-4 h-4" } aria-hidden="true"/>
						</span>
					</When>
				</div>
			) }
		</Listbox.Option>
	);
}

export function ListSelect<T>( props: ListSelectProps<T> ) {
	return (
		<div className={ "w-full" }>
			<Listbox<"div", SelectOption<T>> value={ props.value } onChange={ props.onChange }>
				<When condition={ !!props.label }>
					<label className={ "text-sm text-dark-100 font-semibold" } htmlFor={ props.name }>
						{ props.label }
					</label>
				</When>
				<div
					className={
						"flex w-full text-left rounded-md cursor-default"
						+ "focus:outline-none focus-visible:ring-0 overflow-hidden "
						+ "border-2 border-light-700 text-dark p-2 text-base"
					}
				>
					<Listbox.Button className={ "h-5 flex items-center w-full justify-between" }>
						<span>{ props.value?.label }</span>
						<ChevronUpDownIcon aria-hidden="true" className={ "w-3 h-3" }/>
					</Listbox.Button>
				</div>
				<Transition
					as={ Fragment }
					leave={ "transition ease-in duration-100" }
					leaveFrom={ "opacity-100" }
					leaveTo={ "opacity-0" }
				>
					<Listbox.Options
						className={ "py-1 mt-1 bg-light-100 rounded-md border border-light-700 max-h-60 text-base absolute overflow-auto" }
					>
						{ props.options.map( ( option ) => (
							<ListSelectOption option={ option } key={ option.label }/>
						) ) }
					</Listbox.Options>
				</Transition>
				<When condition={ !!props.message }>
					<InputMessage text={ props.message! } appearance={ props.appearance }/>
				</When>
			</Listbox>
		</div>
	);
}