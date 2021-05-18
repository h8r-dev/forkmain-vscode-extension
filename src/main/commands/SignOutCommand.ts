import * as vscode from "vscode";

import ICommand from "./ICommand";
import { SIGN_OUT } from "./constants";
import registerCommand from "./register";
import { isExistCluster } from "../clusters/utils";

import state from "../state";
import {
  JWT,
  EMAIL,
  KUBE_CONFIG_DIR,
  IS_LOCAL,
  SERVER_CLUSTER_LIST,
} from "../constants";
import host from "../host";
import { IUserInfo } from "../domain";
import { KubeConfigNode } from "../nodes/KubeConfigNode";
import * as fs from "fs";

export default class SignOutCommand implements ICommand {
  command: string = SIGN_OUT;
  constructor(context: vscode.ExtensionContext) {
    registerCommand(context, this.command, false, this.execCommand.bind(this));
  }
  async execCommand(node: KubeConfigNode) {
    const demo = host.getGlobalState(SERVER_CLUSTER_LIST);
    let globalUserList: {
      userInfo: IUserInfo;
      jwt: string;
      id: string;
    }[] = (host.getGlobalState(SERVER_CLUSTER_LIST) || []).filter((it: any) => {
      if (!it.userInfo || !node.id) {
        return true;
      }
      return it.id !== node.id;
    });

    host.setGlobalState(SERVER_CLUSTER_LIST, globalUserList);

    // host.removeGlobalState(JWT);
    // host.removeGlobalState(EMAIL);
    // host.removeGlobalState(USER_INFO_LIST);
    // // remove kubeconfig
    // this.removeAllKubeconfig();
    // state.setLogin(false);
    await vscode.commands.executeCommand("Nocalhost.refresh");

    if (!isExistCluster()) {
      await vscode.commands.executeCommand(
        "setContext",
        "Nocalhost.visibleTree",
        false
      );
      return;
    }
    // remove local
    // host.removeGlobalState(IS_LOCAL);
    // host.removeGlobalState(LOCAL_PATH);
  }

  async removeAllKubeconfig() {
    KUBE_CONFIG_DIR;
    fs.rmdirSync(KUBE_CONFIG_DIR, { recursive: true });
    fs.mkdirSync(KUBE_CONFIG_DIR);
  }
}
