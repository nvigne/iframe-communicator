const WILDCARD_TARGET: string = "*";
const UNKNOWN_DESTINATION: string = "UNKNOWN_DESTINATION"

export type MessageHandler = { (data: any): void };

type Channel = {
    destination: string;
    initialized: boolean;
    token: string;
}

interface ChannelMessage {
    source: string;
    token: string;
}

/**
 * Messaging service is used to perform communication between main window an a frame. It enables two-ways communication.
 */
export class MessagingService {
    private mainWindow: MessageEventSource | undefined | null;
    private interval: number | undefined;
    private handlers: MessageHandler[] = [];

    private channels: Map<string, Channel> = new Map<string, Channel>();

    /**
     * Unique id which represent the current window.
     */
    private id: string;

    /**
     * Default constructor for the messaging service. 
     * @param target The target origin use to send message. 
     * @param frame A reference to the frame we want to communicate with. if no frame is passed, we assume we initialize the frame communication object.
     */
    constructor(private target: string, private frame?: HTMLIFrameElement, overrideId?: string) {
        if (target == WILDCARD_TARGET) {
            throw new Error("Don't use '*' as target.");
        }

        this.id = overrideId ?? this.GetRandomId();
        
        this.mainWindow = undefined;

        window.addEventListener("message", this.listener.bind(this));

        // Use to correctly initialize the messaging service.
        if (this.frame) {
            this.interval = setInterval(this.connectToFrame.bind(this), Math.random() * 1000)
        }
    }

    /**
     * Append a message handler. The callback will be called when receiving a message.
     * @param handler The message handler that will receive the message.
     */
    addMessageHandler(handler: MessageHandler): void {
        this.handlers.push(handler);
    }

    /**
     * Post a message.
     * 
     * Depending on the context, it will send the message to the correct frame (either the main window or the embeded iframe).
     * 
     * @param data The data to be send.
     */
    postMessage<T>(data: T): void {
        if (this.channels.size == 0) {
            throw new Error("No channel.");
        }

        if (!this.AtLeastOneInitializedChannel()) {
            throw new Error("No channel initialized");
        }

        this.postMessageInternal(data);
    }

    private postMessageInternal<T>(data: T): void {
        switch (this.GetType()) {
            case WindowType.Window:
               this.frame?.contentWindow?.postMessage(data, this.target);
               break;
            case WindowType.Frame:
                this.mainWindow?.postMessage(data);
                break;
        }
    }

    private postInitializationMessage(data: ChannelMessage) {
        this.postMessageInternal<ChannelMessage>(data);
    }

    private connectToFrame(): void {
        if (!this.frame) {
            throw new Error();
        }

        if (this.mainWindow) {
            return;
        }

        var token = this.GetRandomId();
        var channel: Channel = {
            token: token,
            destination: UNKNOWN_DESTINATION,
            initialized: false,
        };

        this.channels.set(token, channel)

        this.postInitializationMessage({
            source: this.id,
            token: token,
        });
    }

    private listener(event: MessageEvent<any>): void {
        if (event.origin != this.target) {
            throw new Error("Origin does not match expected target");
        }

        if (event.data) {
            var initializationMessage = event.data as ChannelMessage;
            if (initializationMessage.token) {
                this.initialize(event);
                return;
            }

            this.dispatchEvent(event.data);
        }
    }

    private initialize(event: MessageEvent<any>): void {
        var message = event.data as ChannelMessage;

        // If we already have a reference to the channel, let's update its state.
        if (this.channels.has(message.token)) {
            var channel = this.channels.get(message.token);
            if (channel?.initialized) {
                return;
            }

            this.channels.set(message.token, {
                token: message.token,
                destination: message.source,
                initialized: true,
            })
        } else {
            var newChannel: Channel = {
                token: message.token,
                destination: UNKNOWN_DESTINATION,
                initialized: false,
            };
            this.channels.set(message.token, newChannel);
        }

        this.mainWindow = event.source
        this.postInitializationMessage({
            token: message.token,
            source: this.id,
        });

        if (this.interval) {
            clearInterval(this.interval);
        }
    }

    private dispatchEvent(data: any): void {
        this.handlers.forEach(handler => {
            handler(data);
        });
    }

    private GetType(): WindowType {
        return this.frame ? WindowType.Window : WindowType.Frame;
    }

    private GetRandomId(): string {
        return Math.random().toString().substring(2, 8)
    }

    private AtLeastOneInitializedChannel(): boolean {
        var atLeastOne: boolean = false;
        
        this.channels.forEach(element => {
            if (element.initialized) {
                atLeastOne = true;
            }
        });

        return atLeastOne;
    }
}

enum WindowType {
    Window = "Window",
    Frame = "Frame",
}