import type { Meta, Story } from "@storybook/react";
import type { AvatarProps } from "./avatar";
import { Avatar } from "./avatar";
import React from "react";

export default {
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
} as Meta<AvatarProps>;

const Template: Story<AvatarProps> = ( args ) => <Avatar { ...args } />;

export const Playground = Template.bind( {} );
Playground.args = { size: "md", name: "Yash Gupta" } as AvatarProps;
