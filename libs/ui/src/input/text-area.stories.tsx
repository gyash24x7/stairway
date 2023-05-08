import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import type { Appearance } from "../utils/types";
import { TextArea, TextAreaProps } from "./text-area";

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
	render: args => <TextArea { ...args } />,
	args: {
		name: "message",
		label: "Message",
		placeholder: "Enter your message",
		message: "Write a beautiful message here..."
	}
};