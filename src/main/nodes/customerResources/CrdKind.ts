import * as vscode from "vscode";

import { BaseNocalhostNode } from "../types/nodeType";
import state from "../../state";
import { CrdResource } from "../types/resourceType";
import { KubernetesResourceFolder } from "../abstract/KubernetesResourceFolder";
import { kubernetesResourceDevMode } from "../workloads/KubernetesResourceDevMode";
import { CrdResources } from "./CrdResources";

@kubernetesResourceDevMode(CrdResources)
export class CrdKind extends KubernetesResourceFolder {
  public type: string = "CRD_KIND_FOLDER";
  public label: string;
  public resourceType: string;
  public data: CrdResource;

  constructor(public parent: BaseNocalhostNode, data: CrdResource) {
    super();
    this.parent = parent;
    this.label = `${data.Kind}`;
    this.resourceType = `${data.Resource}.${data.Version}.${data.Group}`;
    this.data = data;
    state.setNode(this.getNodeStateId(), this);
  }

  getTreeItem(): vscode.TreeItem | Thenable<vscode.TreeItem> {
    const collapseState =
      state.get(this.getNodeStateId()) ||
      vscode.TreeItemCollapsibleState.Collapsed;
    return new vscode.TreeItem(
      `${this.data.Kind}(${this.data.Version})`,
      collapseState
    );
  }

  getParent(element?: BaseNocalhostNode): BaseNocalhostNode {
    return this.parent;
  }

  async getChildren(
    parent?: BaseNocalhostNode
  ): Promise<vscode.ProviderResult<any[]>> {
    return [];
  }
}
