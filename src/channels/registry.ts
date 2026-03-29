import type { IChannel } from "./types.js";

export class ChannelRegistry {
  private channels = new Map<string, IChannel>();

  register(channel: IChannel): void {
    this.channels.set(channel.id, channel);
  }

  get(id: string): IChannel {
    const channel = this.channels.get(id);
    if (!channel) throw new Error(`Channel not found: ${id}`);
    return channel;
  }

  getAll(): IChannel[] {
    return [...this.channels.values()];
  }
}
