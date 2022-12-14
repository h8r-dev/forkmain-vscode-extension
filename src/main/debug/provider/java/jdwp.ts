import * as net from "net";
import { ByteBuffer } from "./byteBuffer";

export enum Command {
  version = 1,
}
interface Response {
  id: number;
  flags: number;
  data: ByteBuffer;
  commandSet?: number;
  command?: number;
  errorCode?: number;
}
interface Request {
  command: number;
  commandSet: number;
  id: number;
  data?: any;
}

export class JDWP {
  private id: number = 1;
  constructor(public socket: net.Socket) {}
  static async connect(port: number, timeout = 0) {
    const socket = net.connect(port);

    return new Promise<JDWP>((res, rej) => {
      socket.once("connect", async () => {
        const jdwp = new JDWP(socket);

        jdwp.handshake(res, rej);
      });
      socket.once("error", (err) => {
        rej(err);
      });
      socket.once("close", (err) => {
        rej(err);
      });

      if (timeout > 0) {
        setTimeout(() => rej(new Error("timeout")), timeout * 1000);
      }
    });
  }

  private async handshake(res: Function, rej: Function) {
    this.socket.once("data", (data) => {
      if (data.length < 14) {
        rej(new Error("Minimum length of handshake data is 14 bits"));
      } else {
        const handshake = data.slice(0, 14).toString();

        if (handshake === "JDWP-Handshake") {
          this.socket.on("data", (data) => {
            this.handleData(data);
          });
          res(this);
        } else {
          rej(new Error("missing handshake bytes"));
        }
      }
    });

    this.socket.write(Buffer.from("JDWP-Handshake"));
  }
  private buf: Buffer = Buffer.allocUnsafe(0);

  private handleData(chunk: Buffer) {
    this.buf = this.buf ? Buffer.concat([this.buf, chunk]) : chunk;

    try {
      let unFinish = false;
      do {
        unFinish = this.decode();
      } while (unFinish);
    } catch (err: any) {
      err.name = "JDWPDecodeError";
      err.data = this.buf ? this.buf.toString("base64") : "";

      throw new Error(err);
    }
  }

  private decode() {
    const bufLength = this.buf.length;

    let packetLength = this.buf.readInt32BE(0);
    if (packetLength > bufLength) {
      return false;
    }

    const packet: Response = {
      id: this.buf.readInt32BE(4),
      flags: this.buf[8],
      data: ByteBuffer.wrap(this.buf, 11, packetLength - 11),
    };
    if (packet.flags === 0x80) {
      packet.errorCode = this.buf.readInt16BE(9);
    } else {
      packet.commandSet = this.buf[9];
      packet.command = this.buf[10];
    }

    this.socket.emit("packet", packet);

    const restLen = bufLength - packetLength;
    if (restLen) {
      this.buf = this.buf.slice(packetLength);
      return true;
    }

    this.buf = Buffer.allocUnsafe(0);
    return false;
  }
  private encode(packet: Request) {
    const { data, id, commandSet, command } = packet;

    const length = data ? data.length : 0;
    const buf = Buffer.alloc(11 + length, 0);
    buf.writeInt32BE(11 + length);
    buf.writeInt32BE(id, 4);
    buf[9] = commandSet;
    buf[10] = command;

    if (length > 0) {
      data.copy(buf, 11, 0, length);
    }
    return buf;
  }
  async getVersion(): Promise<{
    description: string;
    jdwpMajor: number;
    jdwpMinor: number;
    vmVersion: string;
    vmName: string;
  }> {
    const res = await this.call({ command: Command.version, commandSet: 1 }, 2);

    const { data } = res;

    return {
      description: data.getString(),
      jdwpMajor: data.getInt(),
      jdwpMinor: data.getInt(),
      vmVersion: data.getString(),
      vmName: data.getString(),
    };
  }
  async destroy() {
    return new Promise<void>((res) => {
      this.socket.on("close", (hasError) => {
        setTimeout(res, 2000);
        this.socket = null;
      });
      this.socket.destroy();
    });
  }
  private async call(request: Omit<Request, "id">, timeout = 0) {
    return new Promise<Response>((res, rej) => {
      const id = this.id++;

      this.socket.on("packet", (data: Response) => {
        if (data.id === id) {
          res(data);
        }
      });

      this.socket.write(this.encode({ ...request, id }));

      if (timeout > 0) {
        setTimeout(() => rej(new Error("timeout")), timeout * 1000);
      }
    });
  }
}
