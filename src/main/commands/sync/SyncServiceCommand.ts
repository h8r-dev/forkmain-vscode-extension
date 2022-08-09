import * as vscode from "vscode";
import ICommand from "../ICommand";

import { OPEN_SYNC_COMMAND, SYNC_SERVICE } from "../constants";
import registerCommand from "../register";
import * as nhctl from "../../ctl/nhctl";
import host from "../../host";
import logger from "../../utils/logger";
import { Associate } from "../../ctl/nhctl";

export interface Sync {
  app: string;
  resourceType: string;
  service: string;
  kubeConfigPath: string;
  namespace: string;
}

export interface SyncMsg {
  status: string;
  msg: string;
  tips: string;
  outOfSync?: string;
  gui: string;
}

export default class SyncServiceCommand implements ICommand {
  command: string = SYNC_SERVICE;
  _id: NodeJS.Timeout | null = null;
  syncData: Partial<Sync>;
  constructor(context: vscode.ExtensionContext) {
    registerCommand(context, this.command, false, this.execCommand.bind(this));
  }
  static stopSyncStatus() {
    vscode.commands.executeCommand(SYNC_SERVICE, {}, true);
  }
  static async checkSync() {
    const currentRootPath = host.getCurrentRootPath();

    if (!currentRootPath) {
      return;
    }

    try {
      const result = (await nhctl.associateQuery({
        current: true,
      })) as Associate.QueryResult;

      if (result) {
        const {
          app,
          svc_type: resourceType,
          svc: service,
          ns: namespace,
        } = result.svc_pack;

        vscode.commands.executeCommand(SYNC_SERVICE, {
          app,
          resourceType,
          service,
          kubeConfigPath: result.kubeconfig_path,
          namespace,
        });
      }
    } catch (err) {
      logger.error("checkSync error:", err);
      vscode.commands.executeCommand(SYNC_SERVICE);
    }
  }
  async execCommand(syncData: Sync, isClearTimeOut?: boolean) {
    if (this._id) {
      clearTimeout(this._id);
      this._id = null;
    }
    if (!isClearTimeOut) {
      this.syncData = syncData || {};
      this.getSyncStatus();
    } else {
      logger.info("after kill clear time sync-status");
    }
  }
  async getSyncStatus() {
    clearTimeout(this._id);

    const syncData = this.syncData;
    try {
      const result = await nhctl.getSyncStatus(
        syncData.resourceType,
        syncData.kubeConfigPath,
        syncData.namespace,
        syncData.app,
        syncData.service
      );

      if (!result) {
        return;
      }
      let r: SyncMsg;
      r = JSON.parse(result) as SyncMsg;

      host.statusBar.text = `$(${this.getIcon(r.status)}) ${r.msg}`;
      host.statusBar.tooltip = r.tips.replace('Nocalhost', 'Forkmain');

      if (r.status !== "end") {
        host.statusBar.command = {
          title: OPEN_SYNC_COMMAND,
          command: OPEN_SYNC_COMMAND,
          arguments: [[r, syncData]],
        };
      } else {
        host.statusBar.command = null;
      }

      host.statusBar.show();
    } catch (e) {
      logger.info("sync-status error");
      console.log(e);
      logger.error(e);
    } finally {
      this._id = setTimeout(async () => {
        await this.getSyncStatus();
      }, 500);
    }
  }

  getIcon(status: string) {
    let icon = "error";

    switch (status) {
      case "outOfSync":
        icon = "warning";
        break;
      case "disconnected":
        icon = "debug-disconnect";
        break;
      case "scanning":
        icon = "sync~spin";
        break;
      case "error":
        icon = "error";
        break;
      case "syncing":
        icon = "cloud-upload";
        break;
      case "idle":
        icon = "check";
        break;
      case "end":
        icon = "error";
        break;
    }
    return icon;
  }
}
