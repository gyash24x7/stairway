import type { Meta, Story } from "@storybook/react";
import { Card, CardProps } from "./card";
import React from "react";

export default {
	component: Card,
	title: "Card"
} as Meta<CardProps>;

const Template: Story<CardProps> = args => <Card { ...args }/>;

export const Playground = Template.bind( {} );
Playground.args = {
	title: "Card Title",
	content: "This is Card Content"
} as CardProps;