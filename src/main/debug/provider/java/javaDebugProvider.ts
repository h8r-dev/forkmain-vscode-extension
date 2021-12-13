import * as vscode from "vscode";
import * as assert from "assert";
import * as AsyncRetry from "async-retry";

import { IDebugProvider } from "../IDebugProvider";
import logger from "../../../utils/logger";
import { JDWP } from "./jdwp";

export class JavaDebugProvider extends IDebugProvider {
  name: string = "Java";
  requireExtensions: string[] = ["vscjava.vscode-java-debug", "redhat.java"];

  getDebugConfiguration(
    name: string,
    port: number,
    remotePath: string
  ): vscode.DebugConfiguration {
    // https://code.visualstudio.com/docs/java/java-debugging
    return {
      type: "java",
      name,
      request: "attach",
      hostName: "localhost",
      port,
    };
  }

  async waitDebuggerStop() {
    await AsyncRetry(
      async () => {
        assert(!vscode.debug.activeDebugSession);
      },
      {
        randomize: false,
        maxTimeout: 1000,
        retries: 10,
      }
    );
    return Promise.resolve();
  }
  async waitDebuggerStart(port: number): Promise<any> {
    const jdwp = await JDWP.connect(port, 2);

    const result = await jdwp.getVersion();
    assert(result);

    logger.debug("jdwp version", result);

    await jdwp.destroy();
  }
}