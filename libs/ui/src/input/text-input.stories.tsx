import { EnvelopeIcon, LockClosedIcon } from "@heroicons/react/24/solid";
import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import type { Appearance } from "../utils/types";
import { TextInput, TextInputProps } from "./text-input";

const meta: Meta<TextInputProps> = {
	component: TextInput,
	title: "TextInput",
	argTypes: {
		appearance: {
			options: [ "default", "danger", "success" ] as Appearance[],
			control: { type: "inline-radio" },
			defaultValue: "neutral",
			description: "Sets the appearance of the Input"
		}
	}
};
export default meta;

export const Playground: StoryObj<TextInputProps> = {
	render:args => <TextInput { ...args } />,
	args: {
		name: "firstName",
		message: "Helper Text",
		label: "Name",
		placeholder: "Enter your Name",
		appearance: "default"
	}
}

export const TextInputWithIconBefore: StoryObj<TextInputProps> ={
	render: args => <TextInput { ...args } />,
	args : {
		name: "email",
		label: "Email",
		type: "email",
		placeholder: "Enter your Email",
		appearance: "default",
		iconBefore: EnvelopeIcon
	}
};

export const TextInputWithIconAfter: StoryObj<TextInputProps> ={
	render: args => <TextInput { ...args } />,
	args: {
		name: "password",
		label: "Password",
		type: "password",
		placeholder: "Enter your Password",
		appearance: "default",
		iconAfter: LockClosedIcon
	}
};
