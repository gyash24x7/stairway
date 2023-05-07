import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { Modal, ModalProps } from "./modal";

const meta: Meta<ModalProps> = { component: Modal, title: "Modal" };
export default meta;

export const Playground: StoryObj<ModalProps> = {
	render:args => <Modal { ...args } />,
	args : {
		title: "Modal StoryObj",
		onClose: () => console.log( "Modal Closed!" ),
		isOpen: true,
		children: <div>Hello from modal child</div>
	}
};