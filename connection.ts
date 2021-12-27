const WILDCARD_TARGET: string = "*";
const UNKNOWN_DESTINATION: string = "UNKNOWN_DESTINATION"
const MINIMUM_TIMEOUT: number = 4;

export type MessageHandler = { (data: any): void };

export interface Logger { 
    log(data: string): void;
};

type Channel = {
    destination: string;
    initialized: boolean;
    token: string;
    state: State;
    window: WindowProxy | undefined | null;
}

type State = "SYN" | "ACK" | "SYN+ACK" | "FIN"

interface ChannelInitializationMessage extends TokenMessage {
    source: string;
    state: State;
    frame: number;
}

interface ChannelMessage extends TokenMessage {
    data: any,
}

interface TokenMessage {
    token: string,
}

enum WindowType {
    Window = "Window",
    Frame = "Frame",
}

/**
 * Two-ways communication service between Window and Frame.
 */
export class MessagingService {
    private interval: number | undefined;
    private handlers: Map<number, MessageHandler> = new Map<number, MessageHandler>();

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
    constructor(private target: string, private frame?: HTMLIFrameElement, overrideId?: string, private logger?: Logger) {
        if (target == WILDCARD_TARGET) {
            throw new Error("Don't use '*' as target.");
        }
        
        this.id = overrideId ?? this.GetRandomNumber();
        
        window.addEventListener("message", this.listener.bind(this));

        if (this.frame) {
            this.delayConnectToFrame();
        }
    }

    private delayConnectToFrame(): void {
        var timeout = Math.floor(Math.random() * 100 + MINIMUM_TIMEOUT);
        this.logger?.log("setInterval with delay: " + timeout + "ms, for: " + this.id)
        this.interval = setTimeout(this.connectToFrame.bind(this), timeout, this.frame)
    }

    /**
     * Append a message handler. The callback will be called when receiving a message.
     * @param handler The message handler that will receive the message.
     */
    addMessageHandler(handler: MessageHandler): number {
        var handlerId = parseInt(this.GetRandomNumber());
        this.handlers.set(handlerId, handler);
        return handlerId;
    }

    /**
     * Delete a message handler from the pool.
     * @param handlerId The handler id returned by the addMessageHandler method.
     */
    removeMessageHandler(handlerId: number): void {
        if (this.handlers.has(handlerId)) {
            this.handlers.delete(handlerId);
        }
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

        // Post to each channel a message.
        this.channels.forEach(channel => {
            if (!channel.initialized) {
                // skip non-initialized channel.
                return;
            }

            var message: ChannelMessage = {
                token: channel.token,
                data: data
            }
            
            this.postMessageInternal(message, channel);
        });

    }

    private postMessageInternal<T>(data: T, channel: Channel): void {
        if (!channel.window) {
            return;
        }

        this.logger?.log("send message to: " + channel.destination + " with token: " + channel.token + ", from: " + this.id);

        switch (this.GetType()) {
            case WindowType.Window:
                channel.window.postMessage(data, this.target);
                break;
            case WindowType.Frame:
                channel.window.postMessage(data, this.target);
                break;
        }
    }

    private postInitializationMessage(data: ChannelInitializationMessage, channel: Channel) {
        this.logger?.log("send handshake with state: " + data.state + ", frame: " + data.frame);

        this.postMessageInternal<ChannelInitializationMessage>(data, channel);
    }

    private connectToFrame(frame: HTMLIFrameElement): void {
        // We expect to have only one channel open here.
        for (let [key, value] of this.channels) {
            // If we changed state, it means initialization is ongoing.
            if (value.state != "SYN") {
                return;
            }
        }

        // Otherwise let's clear the channels and start from fresh.
        this.channels.clear();

        var token = this.GetRandomNumber();
        var channel: Channel = {
            token: token,
            destination: UNKNOWN_DESTINATION,
            initialized: false,
            window: frame.contentWindow,
            state: "SYN",
        };

        this.channels.set(token, channel)

        this.postInitializationMessage({
            source: this.id,
            token: token,
            state: "SYN",
            frame: 1,
        }, channel);

        this.delayConnectToFrame();
    }

    private listener(event: MessageEvent<any>): void {
        if (event.origin != this.target) {
            throw new Error("Origin does not match expected target");
        }

        if (event.data) {
            var initializationMessage = event.data as ChannelInitializationMessage;
            if (initializationMessage.state) {
                this.initialize(event);
                return;
            }

            this.dispatchEvent(event.data);
        }
    }

    /**
     * Initialize channel between the two window. It follows a three-way handshake.
     * 
     * | Window |                                 | Frame |
     * |--------------------------------------------------|
     * |        | ---- SYN (frame + token) -----> |       |
     * |        | <--- SYN+ACK (frame + token) -- |       |
     * |        | ----- ACK (frame + token) ----> |       |
     * 
     * @param event The event receive by the event listener.
     */
    private initialize(event: MessageEvent<any>): void {
        var message = event.data as ChannelInitializationMessage;

        var updatedOrNewChannel: Channel;
        var nextState: State;

        this.logger?.log("receive initialization with state: " + message.state + ", frame: " + message.frame + ", token: " + message.token + ", source: " + message.source)

        if (message.state == "SYN+ACK") {
            if (!this.channels.has(message.token)) {
                return;
            }

            var channel = this.channels.get(message.token);
            if (!channel)
            {
                throw new Error("Unexitisting channel for the given token: " + message.token);
            }

            updatedOrNewChannel = {
                token: message.token,
                destination: message.source,
                initialized: true,
                window: channel.window,
                state: "ACK"
            }

            nextState = "ACK";

            this.channels.set(message.token, updatedOrNewChannel);

            this.postInitializationMessage({
                token: message.token,
                source: this.id,
                state: nextState,
                frame: message.frame + 1,
            }, updatedOrNewChannel);

            
            if (this.interval) {
                clearInterval(this.interval);
            }
        } else if (message.state == "SYN") {
            updatedOrNewChannel = {
                token: message.token,
                destination: UNKNOWN_DESTINATION,
                initialized: false,
                window: event.source as WindowProxy,
                state: "SYN+ACK"
            };

            nextState = "SYN+ACK"

            this.channels.set(message.token, updatedOrNewChannel);

            this.postInitializationMessage({
                token: message.token,
                source: this.id,
                state: nextState,
                frame: message.frame + 1,
            }, updatedOrNewChannel);
        } else if (message.state == "ACK") {
            if (!this.channels.has(message.token)) {
                return;
            }

            var channel = this.channels.get(message.token);
            if (!channel)
            {
                throw new Error("Unexitisting channel for the given token: " + message.token);
            }

            updatedOrNewChannel = {
                token: message.token,
                destination: message.source,
                initialized: true,
                window: channel.window,
                state: "FIN",
            }

            this.channels.set(message.token, updatedOrNewChannel);

            return;
        }
    }

    private dispatchEvent(message: any): void {
        var channelMessage = message as ChannelMessage
        
        // If we don't have a channel for this token, we don't deal with it.
        if (!this.channels.has(channelMessage.token)) {
            return
        }

        this.logger?.log("receive a message from: " + this.channels.get(channelMessage.token)?.destination)

        this.handlers.forEach(handler => {
            handler(channelMessage.data);
        });
    }

    private GetType(): WindowType {
        return this.frame ? WindowType.Window : WindowType.Frame;
    }

    private GetRandomNumber(): string {
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