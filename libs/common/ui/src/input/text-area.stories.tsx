import type { Meta, StoryObj } from "@storybook/react";
import type { Appearance } from "../utils/index.js";
import { TextArea, TextAreaProps } from "./text-area.js";

const meta: Meta<TextAreaProps> = {
	component: TextArea,
	title: "TextArea",
	argTypes: {
		appearance: {
			options: [ "neutral", "danger", "success" ] as Appearance[],
			control: { type: "inline-radio" },
			defaultValue: "neutral",
			description: "Sets the appearance of the TextArea"
		}
	}
};

export default meta;

export const Playground: StoryObj<TextAreaProps> = {
	render: ( props ) => <TextArea { ...props } />,
	args: {
		name: "message",
		label: "Message",
		placeholder: "Enter your message",
		message: "Write a beautiful message here..."
	}
};