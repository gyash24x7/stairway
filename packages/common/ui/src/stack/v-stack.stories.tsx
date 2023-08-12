import type { Meta, StoryObj } from "@storybook/react";
import { VStack, VStackProps } from "./v-stack.js";

const meta: Meta<VStackProps> = {
	component: VStack,
	title: "VStack",
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

export const Playground: StoryObj<VStackProps> = {
	render: ( props ) => (
		<VStack { ...props }>
			<div className={ "bg-blue-300 p-4" }>Stack Child 1</div>
			<div className={ "bg-blue-300 p-4" }>Stack Child 2</div>
			<div className={ "bg-blue-300 p-4" }>Stack Child 3</div>
			<div className={ "bg-blue-300 p-4" }>Stack Child 4</div>
			<div className={ "bg-blue-300 p-4" }>Stack Child 5</div>
			<div className={ "bg-blue-300 p-4" }>Stack Child 6</div>
			<div className={ "bg-blue-300 p-4" }>Stack Child 7</div>
			<div className={ "bg-blue-300 p-4" }>Stack Child 8</div>
			<div className={ "bg-blue-300 p-4" }>Stack Child 9</div>
			<div className={ "bg-blue-300 p-4" }>Stack Child 10</div>
		</VStack>
	)
};