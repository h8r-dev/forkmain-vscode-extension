import * as vscode from "vscode";
import { isEqual } from "lodash";

import { associateQuery, Associate } from "../../ctl/nhctl";
import logger from "../../utils/logger";
import { BaseNode, BaseNodeType, GroupNode } from "./node";
import { SYNC_SERVICE } from "../../commands/constants";

export class SyncManageDataProvider
  extends vscode.Disposable
  implements vscode.TreeDataProvider<BaseNodeType> {
  private time: NodeJS.Timeout;
  private onDidChangeTreeDataEventEmitter = new vscode.EventEmitter<
    BaseNodeType | undefined
  >();
  readonly onDidChangeTreeData?: vscode.Event<void | BaseNodeType> = this
    .onDidChangeTreeDataEventEmitter.event;

  private disposable: vscode.Disposable[] = [];

  private associateData: {
    current: Associate.QueryResult;
    switchCurrent?: Associate.QueryResult;
    other: Associate.QueryResult[];
  };

  constructor() {
    super(() => {
      this.disposable.forEach((item) => item.dispose());
    });

    this.disposable.push(
      vscode.window.onDidChangeActiveColorTheme(() => this.refresh()),
      {
        dispose: () => {
          clearTimeout(this.time);
        },
      }
    );
  }

  changeVisible(visible: boolean) {
    if (visible) {
      this.refresh();
    } else {
      clearTimeout(this.time);
    }
  }
  getParent(element?: BaseNodeType): vscode.ProviderResult<BaseNodeType> {
    if (element) {
      return element.parent;
    }
    return undefined;
  }
  async getData(refresh = false) {
    if (!this.associateData || refresh) {
      const list =
        ((await associateQuery({})) as Associate.QueryResult[]) || [];
      let current = (await associateQuery({
        current: true,
      })) as Associate.QueryResult;

      let { switchCurrent } = this.associateData ?? {};

      if (
        switchCurrent &&
        list.find((item) => item.sha === switchCurrent.sha)
      ) {
        current = switchCurrent;
      }

      const other = list.filter((item) => item.sha !== current.sha);

      this.associateData = {
        current,
        switchCurrent,
        other,
      };
    }

    return this.associateData;
  }

  getTreeItem(
    element: BaseNodeType
  ): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element.getTreeItem();
  }

  async getChildren(element?: BaseNodeType) {
    if (element) {
      return element.getChildren();
    }

    const list = await this.getData();

    if (!list.current && list.other.length === 0) {
      return [new BaseNode(element, "Waiting for enter DevMode")];
    }

    let children: BaseNode[] = [];

    if (list.current) {
      children.push(new GroupNode(element, "current", [list.current]));
    }

    if (list.other.length) {
      children.push(new GroupNode(element, "other", list.other));
    }

    return children;
  }

  public async switchCurrent(node: Associate.QueryResult) {
    const { other, current } = this.associateData;

    this.associateData = {
      other: [current, ...other].filter((item) => item.sha !== node.sha),
      current: node,
      switchCurrent: node,
    };
    this.onDidChangeTreeDataEventEmitter.fire(undefined);

    const {
      kubeconfig_path,
      svc_pack: { app, svc, svc_type, ns },
    } = node;

    vscode.commands.executeCommand(SYNC_SERVICE, {
      app,
      resourceType: svc_type,
      service: svc,
      kubeConfigPath: kubeconfig_path,
      namespace: ns,
    });
  }

  public async refresh() {
    clearTimeout(this.time);

    try {
      const associateData = this.associateData;

      await this.getData(true);

      if (!isEqual(associateData, this.associateData)) {
        this.onDidChangeTreeDataEventEmitter.fire(undefined);
      }
    } catch (error) {
      logger.error("SyncManageProvider refresh", error);
    } finally {
      this.time = setTimeout(async () => {
        this.refresh();
      }, 5_000);
    }
  }
}
