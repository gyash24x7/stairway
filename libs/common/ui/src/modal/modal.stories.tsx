import type { Meta, StoryObj } from "@storybook/react";
import { Modal, ModalProps } from "./modal.js";

const meta: Meta<ModalProps> = {
	component: Modal,
	title: "Modal",
	argTypes: {
		isOpen: {
			type: "boolean"
		}
	}
};

export default meta;

export const Playground: StoryObj<ModalProps> = {
	render: ( props ) => <Modal { ...props } />,
	args: {
		title: "Modal Story",
		onClose: () => console.log( "Modal Closed!" ),
		isOpen: true,
		children: (
			<div>Hello from modal child</div>
		)
	}
};