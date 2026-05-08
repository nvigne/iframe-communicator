import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MessagingService } from "./connection";

type MessageListener = (event: MessageEvent<any>) => void;

class TestWindow {
    private listeners: MessageListener[] = [];

    sourceWindow: TestWindow | null = null;

    addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
        if (type !== "message") {
            return;
        }

        if (typeof listener === "function") {
            this.listeners.push(listener as MessageListener);
        }
    }

    postMessage(data: any, targetOrigin: string): void {
        // MessagingService calls postMessage on the target window proxy, so deliver to this window's listeners.
        this.listeners.forEach(listener => listener({
            data,
            origin: targetOrigin,
            source: this.sourceWindow,
        } as MessageEvent<any>));
    }
}

function useWindow(window: TestWindow): void {
    vi.stubGlobal("window", window);
}

function createConnectedServices(): { parent: MessagingService, frame: MessagingService } {
    const parentWindow = new TestWindow();
    const frameWindow = new TestWindow();

    parentWindow.sourceWindow = frameWindow;
    frameWindow.sourceWindow = parentWindow;

    useWindow(parentWindow);
    const parent = new MessagingService("https://example.test", { contentWindow: frameWindow } as HTMLIFrameElement, "parent");

    useWindow(frameWindow);
    const frame = new MessagingService("https://example.test", undefined, "frame");

    vi.advanceTimersByTime(250);

    return { parent, frame };
}

describe("MessagingService", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it("rejects wildcard target origins", () => {
        useWindow(new TestWindow());

        expect(() => new MessagingService("*")).toThrow("Don't use '*' as target.");
    });

    it("registers and removes message handlers", () => {
        const { parent, frame } = createConnectedServices();
        const activeHandler = vi.fn();
        const removedHandler = vi.fn();

        parent.addMessageHandler(activeHandler);
        const removedHandlerId = parent.addMessageHandler(removedHandler);
        parent.removeMessageHandler(removedHandlerId);

        frame.postMessage("hello");

        expect(activeHandler).toHaveBeenCalledWith("hello");
        expect(removedHandler).not.toHaveBeenCalled();
    });

    it("handshakes between parent and iframe-like windows before bidirectional messaging", () => {
        const { parent, frame } = createConnectedServices();
        const parentHandler = vi.fn();
        const frameHandler = vi.fn();

        parent.addMessageHandler(parentHandler);
        frame.addMessageHandler(frameHandler);

        parent.postMessage({ from: "parent" });
        frame.postMessage({ from: "frame" });

        expect(frameHandler).toHaveBeenCalledWith({ from: "parent" });
        expect(parentHandler).toHaveBeenCalledWith({ from: "frame" });
    });
});
