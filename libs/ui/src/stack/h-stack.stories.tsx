import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { HStack, HStackProps } from "./h-stack";

const meta: Meta<HStackProps> = {
	component: HStack,
	title: "HStack",
	argTypes: {
		spacing: {
			options: [ "xs", "sm", "md", "lg", "xl", "2xl" ],
			control: { type: "inline-radio" },
			description: "Sets the spacing between the stack elements",
			defaultValue: "sm"
		},
		centered: {
			description: "Moves the stack to the center of parent",
			defaultValue: false,
			control: { type: "boolean" }
		}
	}
};
export default meta;

export const Playground: StoryObj<HStackProps> = {
	render: args => (
		<HStack { ...args }>
			<div style={ { background: "#dfe1e6", padding: 20 } }>Stack Child 1</div>
			<div style={ { background: "#c1c7d0", padding: 20 } }>Stack Child 2</div>
			<div style={ { background: "#808080", padding: 20 } }>Stack Child 3</div>
			<div style={ { background: "#808080", padding: 20 } }>Stack Child 4</div>
			<div style={ { background: "#808080", padding: 20 } }>Stack Child 5</div>
			<div style={ { background: "#808080", padding: 20 } }>Stack Child 6</div>
			<div style={ { background: "#808080", padding: 20 } }>Stack Child 7</div>
			<div style={ { background: "#808080", padding: 20 } }>Stack Child 8</div>
			<div style={ { background: "#808080", padding: 20 } }>Stack Child 9</div>
			<div style={ { background: "#808080", padding: 20 } }>Stack Child 10</div>
		</HStack>
	),
	args: {}
}