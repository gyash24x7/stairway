import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { Card, CardProps } from "./card";

const meta: Meta<CardProps> = {
	component: Card,
	title: "Card"
};

export default meta;

export const Playground: StoryObj<CardProps> = {
	render: args => <Card { ...args } />,
	args: {
		title: "Card Title",
		content: "This is Card Content"
	}
};