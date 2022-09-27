import { Dialog, Transition } from "@headlessui/react";
import React, { Fragment, ReactNode } from "react";
import { VariantSchema } from "../utils/variant";

export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children?: ReactNode;
}

export function ModalTitle( props: { title: string } ) {
    return (
        <Dialog.Title as = "h3" className = { "text-xl font-semibold leading-6 mb-4" }>
            { props.title }
        </Dialog.Title>
    );
}

const modalBodyVS = new VariantSchema(
    "text-base",
    { withTitle: { true: "mt-4", false: "" } },
    { withTitle: "false" }
);

export function Modal( { isOpen, onClose, children, title }: ModalProps ) {
    const modalBodyClassname = modalBodyVS.getClassname( { withTitle: !!title ? "true" : "false" } );
    return (
        <Transition appear show = { isOpen } as = { Fragment }>
            <Dialog as = "div" className = { "fixed inset-0 z-10 overflow-y-auto" } onClose = { onClose }>
                <div className = { "min-h-screen px-4 text-center" }>
                    <Transition.Child
                        as = { Fragment }
                        enter = "ease-out duration-300"
                        enterFrom = "opacity-0"
                        enterTo = "opacity-100"
                        leave = "ease-in duration-200"
                        leaveFrom = "opacity-100"
                        leaveTo = "opacity-0"
                    >
                        <Dialog.Overlay className = { "fixed inset-0 bg-dark-700/50" } />
                    </Transition.Child>
                    <span className = { "inline-block h-screen align-middle" } aria-hidden = "true" />
                    <Transition.Child
                        as = { Fragment }
                        enter = "ease-out duration-300"
                        enterFrom = "opacity-0 scale-90"
                        enterTo = "opacity-100 scale-100"
                        leave = "ease-in duration-200"
                        leaveFrom = "opacity-100 scale-100"
                        leaveTo = "opacity-0 scale-90"
                    >
                        <div
                            style = { { maxWidth: 600 } }
                            className = {
                                "inline-block p-6 my-8 overflow-hidden text-left align-middle "
                                + "transition-all transform bg-light-100 shadow-xl rounded-md "
                                + "w-5/6 sm:w-4/5 md:w-3/5 lg:w-1/2"
                            }
                        >
                            { !!title && <ModalTitle title = { title } /> }
                            { children && <div className = { modalBodyClassname }>{ children }</div> }
                        </div>
                    </Transition.Child>
                </div>
            </Dialog>
        </Transition>
    );
}