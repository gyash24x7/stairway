import type { Meta, StoryObj } from "@storybook/react";
import { Flex, FlexProps } from "./flex.js";

const meta: Meta<FlexProps> = {
	component: Flex,
	subcomponents: {},
	title: "Flex",
	argTypes: {
		direction: {
			description: "Sets the axis of flex",
			options: [ "row", "col", "col-reverse", "row-reverse" ],
			control: { type: "inline-radio" },
			defaultValue: "row"
		},
		justify: {
			description: "Sets the distribution of child elements on the flex axis",
			options: [ "start", "end", "center", "space-between", "space-around", "space-evenly" ],
			control: { type: "inline-radio" },
			defaultValue: "start"
		},
		align: {
			description: "Sets the distribution of child elements perpendicular to the flex axis",
			options: [ "start", "end", "center", "baseline", "stretch" ],
			control: { type: "inline-radio" },
			defaultValue: "start"
		}
	}
};

export default meta;

export const Playground: StoryObj<FlexProps> = {
	render: ( args ) => (
		<Flex { ...args }>
			<div className={ "bg-blue-300 p-4" }>Flex Child 1</div>
			<div className={ "bg-blue-500 p-4" }>Flex Child 2</div>
			<div className={ "bg-blue-700 p-4" }>Flex Child 3</div>
		</Flex>
	),
	args: { direction: "row", align: "start", justify: "start" }
};