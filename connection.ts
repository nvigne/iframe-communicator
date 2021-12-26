const TOKEN: string = "INITALIZATION_TOKEN";
const WILDCARD_TARGET: string = "*";

export type MessageHandler = { (data: any): void };

export class MessagingService {
    private mainWindow: MessageEventSource | undefined | null;
    private initialized: boolean = false;
    private interval: number | undefined;
    private handlers: MessageHandler[] = [];

    constructor(private target: string, private frame?: HTMLIFrameElement) {
        if (target == WILDCARD_TARGET) {
            throw new Error("Don't use '*' as target.");
        }
        
        this.mainWindow = undefined;

        window.addEventListener("message", this.listener.bind(this));

        // Use to correctly initialize the messaging service.
        if (this.frame) {
            this.interval = setInterval(this.initialize.bind(this), 10)
        }
    }

    /**
     * Append a message handler. The callback will be called when receiving a message.
     * @param handler The message handler that will receive the message.
     */
    addMessageHandler(handler: MessageHandler): void {
        this.handlers.push(handler);
    }

    listener(event: MessageEvent<any>): void {
        if (event.origin != this.target) {
            throw new Error("Origin does not match expected target");
        }

        if (event.data) {
            if ((event.data as InitializationMessage).token == TOKEN) {
                if (this.initialized) {
                    return;
                }
               
                this.mainWindow = event.source
                this.mainWindow?.postMessage({token: TOKEN} as InitializationMessage);
                this.initialized = true;
                if (this.interval) {
                    clearInterval(this.interval);
                }
                return;
            }

            this.dispatchEvent(event.data);
        }
    }

    postMessage<T>(data: T): void {
        if (!this.initialized) {
            throw new Error("Not initialized yet.")
        }

        switch (this.GetType()) {
            case WindowType.Window:
               this.frame?.contentWindow?.postMessage(data, this.target);
               break;
            case WindowType.Frame:
                this.mainWindow?.postMessage(data);
                break;
        }
    }

    private initialize(): void {
        if (!this.frame) {
            throw new Error();
        }

        if (this.mainWindow) {
            return;
        }

        this.frame.contentWindow?.postMessage({token: TOKEN} as InitializationMessage, this.target);
    }

    private dispatchEvent(data: any): void {
        this.handlers.forEach(handler => {
            handler(data);
        });
    }

    private GetType(): WindowType {
        return this.frame ? WindowType.Window : WindowType.Frame;
    }
}

type InitializationMessage = { token: string; }

enum WindowType {
    Window = "Window",
    Frame = "Frame",
}