import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Avatar } from "../avatar/index.js";
import { SingleSelect, SingleSelectProps } from "./single-select.js";

const meta: Meta<SingleSelectProps<string>> = { component: SingleSelect, title: "Single Select" };

export default meta;

export const Playground: StoryObj<SingleSelectProps<string>> = {
	render: ( props ) => {
		const [ value, setValue ] = useState( props.options[ 0 ] );
		return <SingleSelect { ...props } value={ value } onChange={ setValue }/>;
	},
	args: {
		options: [ "Option A", "Option B", "Option C" ],
		renderOption: ( option, _checked ) => <Avatar name={ option }/>
	}
};
