import { DefaultAzureCredential } from "@azure/identity";
import { describe, expect, test } from "@jest/globals";
import {
  CdmAttribute,
  CdmAttributeItem,
  CdmDataPartitionDefinition,
  CdmDocumentDefinition,
  CdmEntityDefinition,
  CdmManifestDefinition,
  cdmObjectType,
  CdmTypeAttributeDefinition,
} from "cdm.objectmodel/lib/internal";
import { CommonDataModelWriter } from ".";

describe("common datamodel", () => {
  jest.setTimeout(60000);

  test("write cdm", async () => {
    var entityName = "test";
    var datalakeName = "<fill in your own>";
    var datalakePath = "gist/test"; // this needs to exist before running the test

    var identity = new DefaultAzureCredential();

    var cdm = new CommonDataModelWriter(datalakeName, "gist/test", identity);

    await cdm.authenticate();
    cdm.mount();

    var manifest: CdmManifestDefinition = await cdm.newManifest();

    var doc: CdmDocumentDefinition = cdm.addEntityDoc(entityName);
    doc.imports.push("cdm:/foundations.cdm.json"); // if i comment this line the trait is added with the expected format

    var entity: CdmEntityDefinition = cdm.addEntity(entityName, doc, manifest);
    var attributeDef: CdmTypeAttributeDefinition =
      cdm.newAttribute("withTrait");

    var attributeItem: CdmAttributeItem = cdm.addAttribute(
      attributeDef,
      entity
    );

    cdm.addTrait("is.sensitive", entity, attributeDef);

    cdm.addToFolder(manifest);
    await cdm.save(manifest);
  });
});
