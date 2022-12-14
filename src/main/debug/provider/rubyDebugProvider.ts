import { DebugConfiguration } from "vscode";
import { createConnection } from "net";
import { delay } from "lodash";

import { IDebugProvider } from "./IDebugProvider";
import { Language } from ".";

export class RubyDebugProvider extends IDebugProvider {
  name: Language = "ruby";
  requireExtensions: string[] = ["rebornix.Ruby"];

  downloadUrl: string = "https://www.ruby-lang.org/en/downloads/";
  commandName: string = this.name;

  getDebugConfiguration(
    name: string,
    port: number,
    remoteRoot: string
  ): DebugConfiguration {
    // https://github.com/rubyide/vscode-ruby/wiki/2.-Launching-from-VS-Code
    return {
      name,
      type: "Ruby",
      request: "attach",
      remoteWorkspaceRoot: remoteRoot,
      remoteHost: "localhost",
      remotePort: port,
    };
  }

  async waitDebuggerStart(port: number): Promise<void> {
    // https://github.com/ruby-debug/ruby-debug-ide/blob/master/protocol-spec.md
    return new Promise((res, rej) => {
      const client = createConnection(port, "127.0.0.1", () => {
        client.write("thread list\n");
      });

      client.on("error", rej);

      client.on("data", (data) => {
        if (data.toString().includes("<threads>")) {
          client.destroy();

          delay(res, 200);
        }
      });

      delay(() => rej(new Error("timeout")), 5 * 1000);
    });
  }
}
