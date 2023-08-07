import { EnvelopeIcon, LockClosedIcon } from "@heroicons/react/24/solid";
import type { Meta, StoryObj } from "@storybook/react";
import type { Appearance } from "../utils/index.js";
import { TextInput, TextInputProps } from "./text-input.js";

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
	render: ( props ) => <TextInput { ...props } />,
	args: {
		name: "firstName",
		message: "Helper Text",
		label: "Name",
		placeholder: "Enter your Name",
		appearance: "default"
	}
};

export const TextInputWithIconBefore: StoryObj<TextInputProps> = {
	render: ( props ) => <TextInput { ...props } />,
	args: {
		name: "email",
		label: "Email",
		type: "email",
		placeholder: "Enter your Email",
		appearance: "default",
		renderIconBefore: ( props ) => <EnvelopeIcon { ...props }/>
	}
};

export const TextInputWithIconAfter: StoryObj<TextInputProps> = {
	render: ( props ) => <TextInput { ...props } />,
	args: {
		name: "password",
		label: "Password",
		type: "password",
		placeholder: "Enter your Password",
		appearance: "default",
		renderIconAfter: ( props ) => <LockClosedIcon { ...props }/>
	}
};
