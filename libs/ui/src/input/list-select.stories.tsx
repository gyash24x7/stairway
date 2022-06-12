import type { Meta, Story } from "@storybook/react";
import { ListSelect, ListSelectProps } from "./list-select";
import React from "react";

export default { component: ListSelect, title: "ListSelect" } as Meta<ListSelectProps>;

const Template: Story<ListSelectProps> = args => <ListSelect { ...args } />;

export const Playground = Template.bind( {} );
Playground.args = {
	options: [
		{ label: "Person 1", value: "AB" },
		{ label: "Person 2", value: "CD" },
		{ label: "Person 3", value: "EF" }
	],
	label: "Select User",
	message: "Helper Text",
	placeholder: "Select favourite user"
} as ListSelectProps;