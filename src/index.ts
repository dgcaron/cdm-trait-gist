import { CdmCorpusDefinition } from "cdm.objectmodel/lib/Cdm/CdmCorpusDefinition";
import {
  CdmManifestDefinition,
  cdmDataFormat,
  CdmDocumentDefinition,
  CdmEntityDefinition,
  CdmFolderDefinition,
  cdmObjectType,
  CdmTypeAttributeDefinition,
  TokenProvider,
  copyOptions,
  CdmTraitReference,
  CdmTraitReferenceBase,
  CdmAttributeItem,
} from "cdm.objectmodel/lib/internal";
import { ADLSAdapter, CdmStandardsAdapter } from "cdm.objectmodel/lib/Storage";
import { TokenCredential } from "@azure/identity";
import { CdmFolderCollection } from "cdm.objectmodel/lib/cdm-types";

export class CommonDataModelTokenProvider implements TokenProvider {
  token: string;

  constructor(private readonly identity: TokenCredential) {}

  async authenticate(): Promise<boolean> {
    var result = await this.identity.getToken(
      "https://storage.azure.com/.default"
    );
    if (result) {
      this.token = result.token;
      return true;
    }
    return false;
  }

  getToken(): string {
    return `Bearer ${this.token}`;
  }
}

export class CommonDataModelWriter {
  readonly datalakeName?: string;
  readonly datalakePath?: string;

  corpus: CdmCorpusDefinition;

  readonly tokenProvider?: CommonDataModelTokenProvider;

  constructor(
    datalakeName?: string,
    datalakePath?: string,
    identity?: TokenCredential
  ) {
    this.datalakeName = datalakeName;
    this.datalakePath = datalakePath;

    if (identity) {
      this.tokenProvider = new CommonDataModelTokenProvider(identity);
    }
  }

  async authenticate(): Promise<void> {
    if (this.tokenProvider) {
      var authenticated = await this.tokenProvider.authenticate();
      console.log(`user authenticated ${authenticated}`);
    }
  }

  mount() {
    this.corpus = new CdmCorpusDefinition();
    this.corpus.storage.mount("cdm", new CdmStandardsAdapter());

    this.corpus.storage.mount(
      "adls2",
      new ADLSAdapter(
        `${this.datalakeName}.dfs.core.windows.net`,
        this.datalakePath,
        this.tokenProvider
      )
    );
  }

  addToFolder(document: string | CdmDocumentDefinition) {
    const adlsFolder: CdmFolderDefinition =
      this.corpus.storage.fetchRootFolder("adls2");

    if (adlsFolder && adlsFolder.documents) {
      adlsFolder.documents.push(document);
    }
  }

  async newManifest(objectPath?: string): Promise<CdmManifestDefinition> {
    objectPath ??= "default.manifest.cdm.json";

    var manifest = this.corpus.MakeObject<CdmManifestDefinition>(
      cdmObjectType.manifestDef,
      objectPath
    );
    manifest.imports.push("cdm:/foundations.cdm.json");

    return manifest;
  }

  addEntityDoc(name: string): CdmDocumentDefinition {
    const newEntityDoc: CdmDocumentDefinition = this.corpus.MakeObject(
      cdmObjectType.documentDef,
      `${name}.cdm.json`,
      true
    );

    var adls = this.corpus.storage.fetchRootFolder("adls2");
    adls.childFolders ??= new CdmFolderCollection(adls.ctx, adls);
    var documents = adls.documents;
    if (documents) {
      documents.push(newEntityDoc, `${name}.cdm.json`);
    }

    return newEntityDoc;
  }

  addEntity(
    name: string,
    document: CdmDocumentDefinition,
    manifest: CdmManifestDefinition
  ): CdmEntityDefinition {
    var entity = document.definitions.push(
      cdmObjectType.entityDef,
      name
    ) as CdmEntityDefinition;

    var entityDeclaration = manifest.entities.push(
      entity,
      `${name}.cdm.json/${name}`
    );

    return entity;
  }

  newAttribute(name: string): CdmTypeAttributeDefinition {
    const newAttribute: CdmTypeAttributeDefinition = this.corpus.MakeObject(
      cdmObjectType.typeAttributeDef,
      name,
      false
    );
    newAttribute.dataFormat = cdmDataFormat.string;
    return newAttribute;
  }

  addAttribute(
    attribute: CdmTypeAttributeDefinition,
    entity: CdmEntityDefinition
  ): CdmAttributeItem {
    return entity.attributes.push(attribute);
  }

  async addTrait(
    name: string,
    entity: CdmEntityDefinition,
    attribute: CdmTypeAttributeDefinition
  ): Promise<void> {
    const newTrait: CdmTraitReference = this.corpus.MakeObject(
      cdmObjectType.traitRef,
      name,
      false
    );
    newTrait.namedReference = name;
    newTrait.simpleNamedReference = true;
    var exhibits = entity.exhibitsTraits.allItems.find(
      (t) => t.namedReference === name
    );

    if (!exhibits) {
      entity.exhibitsTraits.push(name);
    }

    var trait: CdmTraitReferenceBase = attribute.appliedTraits.push(
      newTrait,
      false
    );
  }

  async save(manifest: CdmManifestDefinition): Promise<void> {
    var options: copyOptions = {
      stringRefs: true,
    };
    var saved = await manifest.saveAsAsync(
      "default.manifest.cdm.json",
      true,
      options
    );

    console.log(`manifest saved ${saved}`);
  }
}
