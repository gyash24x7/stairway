import type { Meta, StoryObj } from "@storybook/react";

import type { Appearance, Size } from "../utils/types";
import { Spinner, SpinnerProps } from "./spinner";

const meta: Meta<SpinnerProps> = {
	component: Spinner,
	title: "Spinner",
	argTypes: {
		appearance: {
			options: [ "primary", "default", "danger", "info", "alt", "warning", "success" ] as Appearance[],
			control: { type: "inline-radio" },
			defaultValue: "default",
			description: "Sets the appearance of the spinner"
		},
		size: {
			options: [ "xs", "sm", "md", "lg", "xl", "2xl" ] as Size[],
			control: { type: "inline-radio" },
			description: "Sets the size of the spinner",
			defaultValue: "medium"
		}
	}
};
export default meta;

export const Playground: StoryObj<SpinnerProps> = {
	render: args => <Spinner { ...args } />,
	args: { size: "md" }
};