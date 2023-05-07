import { ArrowLeftIcon, ArrowRightIcon } from "@heroicons/react/24/solid";
import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import type { Appearance, Size } from "../utils/types";
import { Button, ButtonProps } from "./button";

const meta: Meta = {
	component: Button,
	title: "Button",

	argTypes: {
		iconBefore: {
			description: "Sets the icon before the button text"
		},
		iconAfter: {
			description: "Sets the icon after the button text"
		},
		fullWidth: {
			description: "Sets the width of the button to container",
			defaultValue: false,
			control: { type: "boolean" }
		},
		isLoading: {
			description: "Sets loading state of the button",
			defaultValue: false,
			control: { type: "boolean" }
		},
		buttonText: {
			description: "Sets the text inside the button",
			defaultValue: "Submit",
			control: { type: "text" }
		},
		appearance: {
			options: [ "primary", "default", "danger", "info", "alt", "warning", "success" ] as Appearance[],
			control: { type: "inline-radio" },
			defaultValue: "default",
			description: "Sets the appearance of the button"
		},
		size: {
			options: [ "xs", "sm", "md", "lg", "xl", "2xl" ] as Size[],
			control: { type: "inline-radio" },
			defaultValue: "md",
			description: "Sets the size of the button"
		}
	}
};
export default meta;

export const Playground: StoryObj<ButtonProps> = {
	render: args => <Button { ...args } />,
	args: { buttonText: "Submit", appearance: "default", size: "md" }
};

export const ButtonWithIconBefore: StoryObj<ButtonProps> = {
	render: args => <Button { ...args } />,
	args: {
		buttonText: "Submit",
		appearance: "default",
		size: "md",
		iconBefore: ArrowLeftIcon
	}
};

export const ButtonWithIconAfter: StoryObj<ButtonProps> = {
	render: args => <Button { ...args } />,
	args: {
		buttonText: "Submit",
		appearance: "default",
		size: "md",
		iconAfter: ArrowRightIcon
	}
};