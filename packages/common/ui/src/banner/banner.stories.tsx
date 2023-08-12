import { ExclamationCircleIcon } from "@heroicons/react/24/solid";
import type { Meta, StoryObj } from "@storybook/react";
import type { Appearance, RenderIconProps } from "../utils/index.js";
import { Banner, BannerProps } from "./banner.js";

const meta: Meta<BannerProps> = {
	component: Banner,
	title: "Banner",
	argTypes: {
		renderIcon: {
			description: "Renders the icon before the banner message"
		},
		isLoading: {
			description: "Sets loading state of the banner",
			defaultValue: false,
			control: { type: "boolean" }
		},
		message: {
			description: "Sets the message inside the banner",
			defaultValue: "This is a cool banner message",
			control: { type: "text" }
		},
		appearance: {
			options: [ "primary", "default", "danger", "info", "alt", "warning", "success" ] as Appearance[],
			control: { type: "inline-radio" },
			defaultValue: "default",
			description: "Sets the appearance of the banner"
		}
	}
};

export default meta;

export const Playground: StoryObj<BannerProps> = {
	render: ( props ) => <Banner { ...props } />,
	args: { appearance: "default" }
};

export const BannerWithIcon: StoryObj<BannerProps> = {
	render: ( props ) => <Banner { ...props } />,
	args: { appearance: "default", renderIcon: ( props?: RenderIconProps ) => <ExclamationCircleIcon { ...props }/> }
};