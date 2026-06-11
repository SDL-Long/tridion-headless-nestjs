export interface Keyword {
  itemType: number;
  itemId: number;
  description: string;
  key: string;
  title: string;
  hasChildren: boolean;
  children?: Keyword[];
  parent?: Parent;
  customMetadata: CustomMetadata;
}

export interface Parent {
  itemId: number;
  taxonomyId: number;
  title: string;
}

export interface CustomMetadata {
  [key: string]: any;
}

export interface Categories {
  categories: Keyword[];
}
