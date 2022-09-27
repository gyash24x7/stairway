import type { Meta, Story } from "@storybook/react";
import { Modal, ModalProps } from "./modal";
import React from "react";

export default {
    component: Modal,
    title: "Modal",
    argTypes: {
        size: {
            description: "Sets the size of the modal",
            options: [ "xs", "sm", "md", "lg", "xl", "2xl" ],
            control: { type: "inline-radio" },
            defaultValue: "medium"
        }
    }
} as Meta<ModalProps>;

const Template: Story<ModalProps> = args => <Modal { ...args } />;

export const Playground = Template.bind( {} );
Playground.args = {
    title: "Modal Story",
    onClose: () => console.log( "Modal Closed!" ),
    isOpen: true,
    children: (
        <div>Hello from modal child</div>
    ),
    actions: [
        { appearance: "primary", buttonText: "Action Button" },
        { buttonText: "Cancel", appearance: "default" }
    ]
} as ModalProps;