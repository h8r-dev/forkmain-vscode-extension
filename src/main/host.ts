import * as vscode from "vscode";
import { Progress } from "vscode";
import * as shell from "./ctl/shell";
import { NOCALHOST_INSTALLATION_LINK } from "./constants";

export class Host implements vscode.Disposable {
  private outputChannel: vscode.OutputChannel = vscode.window.createOutputChannel(
    "Nocalhost"
  );
  public outSyncStatusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    101
  );
  public statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  private newTerminal!: vscode.Terminal | null;
  private debugDisposes: Array<{ dispose: () => any }> = [];

  private bookInfoDisposes: Array<{ dispose: () => any }> = [];

  public pushDebugDispose(item: { dispose: () => any }) {
    this.debugDisposes.push(item);
  }

  public disposeDebug() {
    this.debugDisposes.map((item) => {
      if (item) {
        item.dispose();
      }
    });
  }

  public pushBookInfoDispose(item: { dispose: () => any }) {
    this.bookInfoDisposes.push(item);
  }

  public disposeBookInfo() {
    this.bookInfoDisposes.map((item) => {
      if (item) {
        item.dispose();
      }
    });

    this.bookInfoDisposes = [];
  }

  public showInputBox(options: vscode.InputBoxOptions) {
    return vscode.window.showInputBox(options);
  }

  public showProgressing(
    title: string,
    aciton: (
      progress: Progress<{ message?: string; increment?: number }>
    ) => Thenable<unknown>
  ) {
    return vscode.window.withProgress(
      {
        title,
        location: vscode.ProgressLocation.Notification,
        cancellable: false,
      },
      aciton
    );
  }

  showInformationMessage(
    msg: string,
    options?: vscode.MessageOptions,
    ...items: string[]
  ) {
    if (options && options.modal) {
      return vscode.window.showInformationMessage(msg, options, ...items);
    }
    return new Promise((res, rej) => {
      setTimeout(() => {
        res(undefined);
      }, 20 * 1000);
      if (options) {
        vscode.window.showInformationMessage(msg, options, ...items).then(
          (value) => {
            res(value);
          },
          (err) => rej(err)
        );
      } else {
        vscode.window.showInformationMessage(msg, ...items).then(
          (value) => {
            res(value);
          },
          (err) => rej(err)
        );
      }
    });
  }

  showErrorMessage(msg: string) {
    return vscode.window.showErrorMessage(msg);
  }

  showWarnMessage(msg: string) {
    return vscode.window.showWarningMessage(msg);
  }

  showOpenDialog(options: vscode.OpenDialogOptions) {
    return vscode.window.showOpenDialog(options);
  }

  showSelectFolderDialog(title: string, defaultUri?: vscode.Uri) {
    return this.showOpenDialog({
      defaultUri: defaultUri,
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      title: title,
    });
  }

  showSelectFileDialog(title: string, defaultUri?: vscode.Uri) {
    return this.showOpenDialog({
      defaultUri: defaultUri,
      canSelectFolders: false,
      canSelectFiles: true,
      canSelectMany: false,
      title: title,
    });
  }

  copyTextToclipboard(text: string) {
    vscode.env.clipboard.writeText(text);
  }

  getOutputChannel() {
    return this.outputChannel;
  }

  invokeInNewTerminal(command: string, name?: string) {
    this.newTerminal = vscode.window.createTerminal(name);
    this.newTerminal.show();
    this.newTerminal.sendText(command);
    return this.newTerminal;
  }

  invokeInNewTerminalSpecialShell(
    commands: string[],
    shellPath: string,
    name: string
  ) {
    return vscode.window.createTerminal({
      name,
      shellArgs: commands,
      shellPath,
    });
  }

  log(msg: string, line?: boolean) {
    if (line) {
      this.outputChannel.appendLine(msg);
    } else {
      this.outputChannel.append(msg);
    }
  }

  dispose() {
    this.statusBar.dispose();
    this.outputChannel.dispose();
    this.disposeDebug();
    this.disposeBookInfo();
    if (this.newTerminal) {
      this.newTerminal.dispose();
    }
  }

  getCurrentRootPath() {
    return (
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders.length > 0 &&
      vscode.workspace.workspaceFolders[0].uri.fsPath
    );
  }

  delay(time: number) {
    return new Promise<void>((res, rej) => {
      setTimeout(() => {
        res();
      }, time);
    });
  }

  isWindow() {
    return process.platform === "win32";
  }

  formalizePath(path: string) {
    if (this.isWindow()) {
      return `"${path}"`;
    } else {
      return path.replace(/ /g, "\\ ");
    }
  }

  async check() {
    const tools = ["kubectl", "nhctl"];
    for (let i = 0; i < tools.length; i++) {
      const exist = shell.which(tools[i]);
      if (!exist) {
        switch (tools[i]) {
          case "kubectl": {
            vscode.window.showErrorMessage(
              "kubectl not found, please install kubectl first."
            );
            break;
          }
          case "nhctl": {
            const result:
              | string
              | undefined = await vscode.window.showErrorMessage(
              "nhctl not found, please install nhctl first.",
              "Get nhctl"
            );
            if (result === "Get nhctl") {
              vscode.env.openExternal(
                vscode.Uri.parse(NOCALHOST_INSTALLATION_LINK)
              );
            }
            break;
          }
        }
      }
    }
  }
}

export default new Host();
