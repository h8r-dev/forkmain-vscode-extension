import * as vscode from "vscode";
import * as os from "os";
import { existsSync } from "fs";
import ICommand from "./ICommand";
import { START_DEV_MODE, SYNC_SERVICE } from "./constants";
import registerCommand from "./register";
import {
  TMP_APP,
  TMP_CONTAINER,
  TMP_MODE,
  TMP_DEVSPACE,
  TMP_DEVSTART_APPEND_COMMAND,
  TMP_DEV_START_COMMAND,
  TMP_DEV_START_IMAGE,
  TMP_ID,
  TMP_KUBECONFIG_PATH,
  TMP_NAMESPACE,
  TMP_RESOURCE_TYPE,
  TMP_STATUS,
  TMP_STORAGE_CLASS,
  TMP_WORKLOAD,
  TMP_WORKLOAD_PATH,
  TMP_HEADER,
  FORKMAIN_BASE_DIR,
} from "../constants";
import host, { Host } from "../host";
import * as path from "path";
import git from "../ctl/git";
import ConfigService from "../service/configService";
import * as nhctl from "../ctl/nhctl";
import * as nls from "../../../package.nls.json";
import { replaceSpacePath } from "../utils/fileUtil";
import { BaseNocalhostNode, DeploymentStatus } from "../nodes/types/nodeType";
import { ControllerResourceNode } from "../nodes/workloads/controllerResources/ControllerResourceNode";
import messageBus from "../utils/messageBus";
import logger from "../utils/logger";
import { getContainer } from "../utils/getContainer";
import SyncServiceCommand from "./sync/SyncServiceCommand";
import { getContainers } from "../ctl/nhctl";
import state from "../state";

export interface ControllerNodeApi {
  name: string;
  resourceType: string;
  setStatus: (status: string) => Promise<void>;
  getStatus: (refresh?: boolean) => Promise<string> | string;
  setContainer: (container: string) => Promise<void>;
  getContainer: () => Promise<string>;
  getKubeConfigPath: () => string;
  getAppName: () => string;
  getParent: () => BaseNocalhostNode;
  getStorageClass: () => string | undefined;
  getDevStartAppendCommand: () => string | undefined;
  getSpaceName: () => string;
  getNameSpace: () => string;
}

type StartDevModeInfoType = {
  image?: string;
  mode?: "replace" | "copy";
  header?: string;
  command?: string;
  isAutoMode?: boolean;
};

const ValidWorkloadTypes: string[] = [
  "Deployments",
  "StatefulSets",
  "DaemonSets",
  "Jobs",
  "CronJobs",
  "Pods",
];

export default class StartDevModeCommand implements ICommand {
  command: string = START_DEV_MODE;
  context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    registerCommand(context, this.command, true, this.execCommand.bind(this));
  }

  private info?: StartDevModeInfoType;
  private node: ControllerNodeApi;
  private containerName: string;

  async execCommand(node: ControllerNodeApi, info?: StartDevModeInfoType) {
    if (!node) {
      await host.showWarnMessage("Failed to get node.");
      return;
    }

    host.log(`${this.command} command executed!`, true);

    let image = info?.image;
    const mode = info?.mode || "replace";
    const header = info?.header;
    this.node = node;
    this.info = info;

    // is config valid
    const appName = node.getAppName();
    const { name, resourceType } = node;
    const namespace = node.getNameSpace();
    const kubeConfigPath = node.getKubeConfigPath();

    host.showProgressing("Connecting to remote workspace...", async () => {
      // Do not check CRD workload.
      // Todo: resourceType didn't coincidence.
      if (ValidWorkloadTypes.includes(node.resourceType)) {
        host.log(`${this.command}: auth check...`, true);
        await nhctl.NhctlCommand.authCheck({
          base: "dev",
          args: ["start", appName, "-t" + node.resourceType, node.name],
          kubeConfigPath: kubeConfigPath,
          namespace,
        }).exec();
      }

      host.log("[start dev] Initializing..", true);

      // get container name from storage
      let containerName = await node.getContainer();
      if (!containerName) {
        host.log("Get container name...", true);
        containerName = await getContainer({
          appName,
          name,
          resourceType,
          namespace,
          kubeConfigPath,
        });
      }

      host.log(`[start dev] Start container: ${containerName}`, true);

      this.containerName = containerName;

      // Alert developer when multi developers are working on same service.
      if (containerName === "nocalhost-dev") {
        host.showErrorMessage(
          "Error: The service is already under developing, exit."
        );
        return;
      }

      host.log("Get local workspace source code dir...", true);

      const destDir = await this.cloneOrGetFolderDir(
        appName,
        node,
        containerName
      );

      if (!destDir) {
        return;
      }

      host.log("Get Image name...", true);
      image = await this.getImageName(image, containerName);

      if (!image) {
        return;
      }

      host.log("Save dev config...", true);
      await this.saveConfig(
        kubeConfigPath,
        namespace,
        appName,
        name,
        resourceType,
        containerName,
        "image",
        image as string
      );

      host.log("[destDir]" + destDir, true);
      host.log("[getCurrentRootPath]" + host.getCurrentRootPath(), true);

      if (
        destDir === true ||
        (destDir && destDir === host.getCurrentRootPath())
      ) {
        host.log("Start dev mode...", true);
        await this.startDevMode(
          host,
          appName,
          node,
          containerName,
          mode,
          image,
          header
        );
      } else if (destDir) {
        this.saveAndOpenFolder(
          appName,
          node,
          destDir,
          containerName,
          mode,
          image,
          header
        );
        host.log("Emit devStart event...", true);
        messageBus.emit("devStart", {
          name: appName,
          destDir,
          container: containerName,
        });
      }
    });
  }

  private async firstOpen(
    appName: string,
    node: ControllerNodeApi,
    containerName: string
  ) {
    let destDir: string | undefined;
    const result = await host.showInformationMessage(
      nls["tips.clone"],
      { modal: true },
      nls["bt.clone"],
      nls["bt.open.dir"]
    );
    if (!result) {
      return;
    }
    if (result === nls["bt.clone"]) {
      destDir = await this.cloneCode(
        host,
        node.getKubeConfigPath(),
        node.getNameSpace(),
        appName,
        node.name,
        node.resourceType,
        containerName
      );
    } else if (result === nls["bt.open.dir"]) {
      const uris = await host.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
      });
      if (uris && uris.length > 0) {
        destDir = uris[0].fsPath;
      }
    }

    return destDir;
  }

  private async getImageName(image: string | undefined, containerName: string) {
    // check image
    if (image) {
      return image;
    }

    image = await this.getImage(
      this.node.getKubeConfigPath(),
      this.node.getNameSpace(),
      this.node.getAppName(),
      this.node.name,
      this.node.resourceType,
      containerName
    );

    if (!image) {
      const result = await host.showInformationMessage(
        "Please specify development image",
        { modal: true },
        "Select",
        "Custom"
      );
      if (!result) {
        return;
      }
      if (result === "Select") {
        const images = [
          "nocalhost-docker.pkg.coding.net/nocalhost/dev-images/java:11",
          "nocalhost-docker.pkg.coding.net/nocalhost/dev-images/ruby:3.0",
          "nocalhost-docker.pkg.coding.net/nocalhost/dev-images/node:14",
          "nocalhost-docker.pkg.coding.net/nocalhost/dev-images/python:3.9",
          "nocalhost-docker.pkg.coding.net/nocalhost/dev-images/golang:1.16",
          "nocalhost-docker.pkg.coding.net/nocalhost/dev-images/perl:latest",
          "nocalhost-docker.pkg.coding.net/nocalhost/dev-images/rust:latest",
          "nocalhost-docker.pkg.coding.net/nocalhost/dev-images/php:latest",
        ];
        image = await host.showQuickPick(images);
      } else if (result === "Custom") {
        image = await host.showInputBox({
          placeHolder: "Please input your image address",
        });
      }
    }

    return image;
  }

  private saveAndOpenFolder(
    appName: string,
    node: ControllerNodeApi,
    destDir: string,
    containerName: string,
    mode: string,
    image: string,
    header: string
  ) {
    const currentUri = host.getCurrentRootPath();

    const uri = vscode.Uri.file(destDir);
    if (currentUri !== uri.fsPath) {
      vscode.commands.executeCommand("vscode.openFolder", uri, true);
      this.setTmpStartRecord(
        appName,
        uri.fsPath,
        node as ControllerResourceNode,
        containerName,
        mode,
        image,
        header
      );
    }
  }

  private async cloneCode(
    host: Host,
    kubeConfigPath: string,
    namespace: string,
    appName: string,
    workloadName: string,
    workloadType: string,
    containerName: string
  ): Promise<string | undefined> {
    let destDir: string | undefined;
    let gitUrl: string | undefined = await this.getGitUrl(
      kubeConfigPath,
      namespace,
      appName,
      workloadName,
      workloadType,
      containerName
    );

    if (!gitUrl) {
      host.showErrorMessage("Error: No Git URL found on this service");
      return destDir;
    }

    // Use appName from URI
    const application = state.getData("app");
    destDir = path.resolve(
      FORKMAIN_BASE_DIR,
      application.appName,
      workloadName
    );

    // If destination dir already existed, use it directly.
    if (existsSync(destDir)) {
      return destDir;
    }

    const [saveResult, cloneResult] = await Promise.all([
      this.saveConfig(
        kubeConfigPath,
        namespace,
        appName,
        workloadName,
        workloadType,
        containerName,
        "gitUrl",
        gitUrl
      ),
      host.showProgressing("Cloning source code...", async (progress) => {
        const result = await git.clone(host, gitUrl as string, [
          replaceSpacePath(destDir) as string,
        ]);
        return result;
      }),
    ]);

    if (!cloneResult) {
      return "";
    }

    return destDir;
  }

  private async saveConfig(
    kubeConfigPath: string,
    namespace: string,
    appName: string,
    workloadName: string,
    workloadType: string,
    containerName: string,
    key: string,
    value: string
  ) {
    await nhctl.profileConfig({
      kubeConfigPath,
      namespace,
      workloadType,
      workloadName,
      appName,
      containerName,
      key,
      value,
    });
  }

  private async getTargetDirectory() {
    let destDir: string | undefined;

    const getUrl = async () => {
      const uris = await host.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
      });
      if (uris && uris.length > 0) {
        destDir = uris[0].fsPath;
      }
    };

    const result = nls["bt.open.dir"];

    if (result === nls["bt.open.other"]) {
      await getUrl();
    } else if (result === nls["bt.open.dir"]) {
      destDir = await this.getAssociateDirectory();
      if (!existsSync(destDir)) {
        destDir = undefined;
        const res = await host.showInformationMessage(
          "The directory does not exist, do you want to associate the new source code directory.",
          { modal: true },
          "Associate"
        );

        if (res === "Associate") {
          await getUrl();
        }
      }
    }

    return destDir;
  }

  private async getAssociateDirectory(): Promise<string> {
    const { containerName, node } = this;

    const associateDir = await nhctl.associateInfo(
      node.getKubeConfigPath(),
      node.getNameSpace(),
      node.getAppName(),
      node.resourceType,
      node.name,
      containerName
    );

    return associateDir;
  }

  private async cloneOrGetFolderDir(
    appName: string,
    node: ControllerNodeApi,
    containerName: string
  ) {
    let destDir: string | undefined | boolean;
    const associateDir = await this.getAssociateDirectory();
    const currentUri = host.getCurrentRootPath();

    if (!associateDir) {
      destDir = await this.firstOpen(appName, node, containerName);
    } else if (currentUri !== associateDir) {
      destDir = await this.getTargetDirectory();
    } else {
      destDir = true;
    }

    if (destDir && destDir !== true) {
      if (host.isWindow) {
        // Make drive letter lowercase to equal `vscode.workspace.workspaceFolders`
        // Issue: https://github.com/microsoft/vscode/issues/116232
        const driveLetterRegExp = /^[A-Za-z]:/;
        const replace = destDir.match(driveLetterRegExp)?.[0]?.toLowerCase();
        replace && (destDir = destDir.replace(driveLetterRegExp, replace));
      }

      await nhctl.associate(
        node.getKubeConfigPath(),
        node.getNameSpace(),
        node.getAppName(),
        destDir as string,
        node.resourceType,
        node.name,
        containerName
      );

      if (host.getCurrentRootPath() === destDir) {
        SyncServiceCommand.checkSync();
      }
    }

    return destDir;
  }

  async startDevMode(
    host: Host,
    appName: string,
    node: ControllerNodeApi,
    containerName: string,
    mode: "replace" | "copy",
    image: string,
    header?: string
  ) {
    const currentUri = host.getCurrentRootPath() || os.homedir();

    try {
      await node.setStatus(DeploymentStatus.starting);
      host.getOutputChannel().show(true);

      host.log(`dev[${mode}] start ...`, true);
      let dirs: Array<string> | string = new Array<string>();
      let isOld = false;
      dirs = host.formalizePath(currentUri);

      // update deployment label
      node.setContainer(containerName);

      await nhctl.devStart(
        host,
        node.getKubeConfigPath(),
        node.getNameSpace(),
        appName,
        node.name,
        node.resourceType,
        {
          isOld: isOld,
          dirs: dirs,
        },
        mode,
        containerName,
        node.getStorageClass(),
        node.getDevStartAppendCommand(),
        image,
        header
      );

      host.log("dev start end", true);
      host.log("", true);

      host.log("sync file ...", true);

      await nhctl.syncFile(
        host,
        node.getKubeConfigPath(),
        node.getNameSpace(),
        appName,
        node.name,
        node.resourceType,
        containerName
      );

      host.log("sync file end", true);
      host.log("", true);
      node.setStatus("");
      const parent = node.getParent();
      if (parent && parent.updateData) {
        await parent.updateData(true);
      }
      await vscode.commands.executeCommand("Forkmain.refresh", parent);

      const terminal = await nhctl.devTerminal(
        node.getAppName(),
        node.name,
        node.resourceType,
        "nocalhost-dev",
        node.getKubeConfigPath(),
        node.getNameSpace(),
        null
      );

      host.pushDispose(
        node.getSpaceName(),
        node.getAppName(),
        node.name,
        terminal
      );

      vscode.commands.executeCommand(SYNC_SERVICE, {
        app: appName,
        resourceType: node.resourceType,
        service: node.name,
        kubeConfigPath: node.getKubeConfigPath(),
        namespace: node.getNameSpace(),
      });

      if (this.info?.command) {
        vscode.commands.executeCommand(this.info?.command, node, {
          command: START_DEV_MODE,
          ...this.info,
        });
      }
    } catch (error) {
      logger.error(error);
      node.setStatus("");
    }
  }

  private setTmpStartRecord(
    appName: string,
    workloadPath: string,
    node: ControllerResourceNode,
    containerName: string,
    mode: string,
    image: string,
    header: string
  ) {
    const appNode = node.getAppNode();
    host.setGlobalState(TMP_ID, node.getNodeStateId());
    host.setGlobalState(TMP_DEVSPACE, node.getSpaceName());
    host.setGlobalState(TMP_NAMESPACE, node.getNameSpace());
    host.setGlobalState(TMP_APP, appName);
    host.setGlobalState(TMP_WORKLOAD, node.name);
    host.setGlobalState(TMP_STATUS, `${node.getNodeStateId()}_status`);
    host.setGlobalState(TMP_RESOURCE_TYPE, node.resourceType);
    host.setGlobalState(TMP_KUBECONFIG_PATH, appNode.getKubeConfigPath());
    host.setGlobalState(TMP_WORKLOAD_PATH, workloadPath);
    host.setGlobalState(TMP_CONTAINER, containerName);

    if (this.info?.command) {
      host.setGlobalState(TMP_DEV_START_COMMAND, this.info?.command);
    }

    host.setGlobalState(TMP_MODE, mode);
    host.setGlobalState(TMP_HEADER, header);
    host.setGlobalState(TMP_DEV_START_IMAGE, image);
    const storageClass = node.getStorageClass();
    if (storageClass) {
      host.setGlobalState(TMP_STORAGE_CLASS, storageClass);
    }

    const devStartAppendCommand = node.getDevStartAppendCommand();
    if (devStartAppendCommand) {
      host.setGlobalState(TMP_DEVSTART_APPEND_COMMAND, devStartAppendCommand);
    }
  }

  private async getGitUrl(
    kubeConfigPath: string,
    namespace: string,
    appName: string,
    workloadName: string,
    workloadType: string,
    containerName: string
  ) {
    const config = await ConfigService.getContaienrConfig(
      kubeConfigPath,
      namespace,
      appName,
      workloadName,
      workloadType,
      containerName
    );
    let gitUrl = "";
    if (config) {
      gitUrl = config.dev.gitUrl;
    }

    return gitUrl;
  }

  private async getImage(
    kubeConfigPath: string,
    namespace: string,
    appName: string,
    workloadName: string,
    workloadType: string,
    containerName: string
  ) {
    const result = await nhctl.getImageByContainer({
      kubeConfigPath,
      namespace,
      workloadType,
      appName,
      workloadName,
      containerName,
    });
    if (!result) {
      return undefined;
    }
    return result.image;
  }

  async getPodAndContainer(node: ControllerNodeApi) {
    const kubeConfigPath = node.getKubeConfigPath();
    let podName: string | undefined;
    const podNameArr = await nhctl.getPodNames({
      name: node.name,
      kind: node.resourceType,
      namespace: node.getNameSpace(),
      kubeConfigPath: kubeConfigPath,
    });
    podName = podNameArr[0];
    if (!podName) {
      return;
    }
    let containerName: string | undefined = (await node.getContainer()) || "";

    if (!containerName) {
      const containerNameArr = await getContainers({
        appName: node.getAppName(),
        name: node.name,
        resourceType: node.resourceType,
        kubeConfigPath,
        namespace: node.getNameSpace(),
      });
      if (containerNameArr.length === 1) {
        containerName = containerNameArr[0];
      } else {
        if (containerNameArr.length > 1) {
          containerName = await host.showQuickPick(containerNameArr);
        }
      }
    }

    return { containerName, podName };
  }
}
