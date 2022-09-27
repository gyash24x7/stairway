import React, { Fragment, ReactNode } from "react";
import { RadioGroup } from "@headlessui/react";
import { HStack } from "../stack/h-stack";
import { VariantSchema } from "../utils/variant";

export interface SingleSelectProps<T> {
    value?: T;
    onChange: ( v: T ) => void | Promise<void>;
    options: T[];
    renderOption: ( option: T, checked: boolean ) => ReactNode;
}

const radioSelectOptionVS = new VariantSchema(
    "hover:bg-light-300 outline-none cursor-pointer my-2 p-2 rounded-md",
    { checked: { true: "bg-primary-100 hover:bg-primary-100", false: "" } },
    { checked: "false" }
);

export function SingleSelect<T>( props: SingleSelectProps<T> ) {
    const radioSelectOptionClassname = ( { checked }: { checked: boolean } ) => {
        return radioSelectOptionVS.getClassname( { checked: checked ? "true" : "false" } );
    };

    return (
        <RadioGroup value = { props.value } onChange = { props.onChange }>
            <HStack wrap spacing = { "xs" }>
                { props.options.map( ( option, index ) => (
                    <RadioGroup.Option
                        value = { option }
                        key = { index }
                        className = { radioSelectOptionClassname }
                    >
                        { ( { checked } ) => (
                            <Fragment>
                                { props.renderOption( option, checked ) }
                            </Fragment>
                        ) }
                    </RadioGroup.Option>
                ) ) }
            </HStack>
        </RadioGroup>
    );
}