import type { Meta, StoryObj } from "@storybook/react";
import { Card, CardProps } from "./card.js";

const meta: Meta<CardProps> = { component: Card, title: "Card" };

export default meta;

export const Playground: StoryObj<CardProps> = {
	render: ( props ) => <Card { ...props } />,
	args: { title: "Card Title", content: "This is Card Content" }
};