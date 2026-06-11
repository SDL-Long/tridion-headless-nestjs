export class PublicationMapping {
  domain: string;
  path: string;
  port: string;
  protocol: string;
  publicationId: number;
  pathScanDepth: number;

  constructor(mapping: any) {
    (this.domain = mapping.domain),
      (this.path = mapping.path),
      (this.port = mapping.port),
      (this.protocol = mapping.protocol),
      (this.publicationId = mapping.publicationId),
      (this.pathScanDepth = mapping.pathScanDepth);
  }
}
