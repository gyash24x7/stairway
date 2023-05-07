import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import type { AvatarProps } from "./avatar";
import { Avatar } from "./avatar";

const meta: Meta<AvatarProps> = {
	component: Avatar,
	title: "Avatar",
	argTypes: {
		size: {
			description: "Sets the size of the avatar",
			options: [ "xs", "sm", "md", "lg", "xl", "2xl" ],
			control: { type: "inline-radio" },
			defaultValue: "medium"
		},
		src: {
			description: "Sets the image to be shown as avatar"
		}
	}
};

export default meta;

export const Playground: StoryObj<AvatarProps> = {
	render: ( args ) => <Avatar { ...args } />,
	args: { size: "md", name: "Yash Gupta" } as AvatarProps
};
