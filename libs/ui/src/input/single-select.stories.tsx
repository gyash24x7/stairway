import type { Meta, StoryObj } from "@storybook/react";
import React, { useState } from "react";
import { Avatar } from "../avatar/avatar";
import { SingleSelect, SingleSelectProps } from "./single-select";

const meta: Meta<SingleSelectProps<string>> = { component: SingleSelect, title: "Single Select" };
export default meta;

export const Playground: StoryObj<SingleSelectProps<string>> = {
	render: ( args ) => {
		const [ value, setValue ] = useState( args.options[ 0 ] );
		return <SingleSelect { ...args } value={ value } onChange={ setValue }/>;
	},
	args: {
		options: [ "Option A", "Option B", "Option C" ],
		renderOption: ( option, _checked ) => <Avatar name={ option }/>
	}
};
