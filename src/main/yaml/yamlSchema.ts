import * as semver from "semver";
import * as vscode from "vscode";

import * as appSchema from "../../../schemas/nocalhost.app.config.json";
import * as serviceSchema from "../../../schemas/nocalhost.service.config.json";

declare type YamlSchemaContributor = (
  schema: string,
  requestSchema: (resource: string) => string | undefined,
  requestSchemaContent: (uri: string) => string | undefined
) => void;

// see docs from YamlSchemaContributor
function requestYamlSchemaUriCallback(resource: string): string | undefined {
  const resourceUri = vscode.Uri.parse(resource);
  const authority = resourceUri.authority;
  // ForkmainRW://nh/config/app/coding-agile/services/api-docs-backend.yaml  service config
  // ForkmainRW://nh/config/app/coding-agile.yaml  app config
  if (authority === "nh") {
    const paths = resourceUri.path.split("/");
    const type = paths[1];
    if (type === "config") {
      const isService = paths[2] === "app" && paths[4] === "services";
      if (isService) {
        return "ForkmainRW://schema/config/service";
      }

      return "ForkmainRW://schema/config/app";
    }
  }
  return undefined;
}

// see docs from YamlSchemaContributor
function requestYamlSchemaContentCallback(uri: string): string | undefined {
  if (uri === "ForkmainRW://schema/config/app") {
    return JSON.stringify(appSchema);
  } else if (uri === "ForkmainRW://schema/config/service") {
    return JSON.stringify(serviceSchema);
  }

  return "";
}

export async function registerYamlSchemaSupport(): Promise<void> {
  const yamlPlugin = await activateYamlExtension();
  if (!yamlPlugin || !yamlPlugin.registerContributor) {
    // activateYamlExtension has already alerted to users for errors.
    return;
  }
  // register for kubernetes schema provider
  yamlPlugin.registerContributor(
    "ForkmainRW",
    requestYamlSchemaUriCallback,
    requestYamlSchemaContentCallback
  );
}

async function activateYamlExtension(): Promise<
  { registerContributor: YamlSchemaContributor } | undefined
> {
  const ext = vscode.extensions.getExtension("redhat.vscode-yaml");
  if (!ext) {
    vscode.window.showWarningMessage(
      "Please install 'YAML Support by Red Hat' via the Extensions pane."
    );
    return undefined;
  }
  const yamlPlugin = await ext.activate();

  if (!yamlPlugin || !yamlPlugin.registerContributor) {
    vscode.window.showWarningMessage(
      "The installed Red Hat YAML extension doesn't support Forkmain Intellisense. Please upgrade 'YAML Support by Red Hat' via the Extensions pane."
    );
    return undefined;
  }

  if (
    ext.packageJSON.version &&
    !semver.gte(ext.packageJSON.version, "0.0.15")
  ) {
    vscode.window.showWarningMessage(
      "The installed Red Hat YAML extension doesn't support multiple schemas. Please upgrade 'YAML Support by Red Hat' via the Extensions pane."
    );
  }
  return yamlPlugin;
}
