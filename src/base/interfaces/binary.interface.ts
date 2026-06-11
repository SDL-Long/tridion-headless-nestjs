export interface BinaryComponent {
  id: string;
  title: string;
  schemaId?: string;
  publicationId: number;
  description?: string;
  downloadUrl: string;
  url: string;
  path: string;
  componentCustomMetadata?: CustomMetadata;
}

export interface CustomMetadata {
  [key: string]: any;
}

export interface BinaryResponse {
  data: Buffer;
  type: string | null;
}
