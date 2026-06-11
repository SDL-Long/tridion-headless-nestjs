export interface PageTemplate {
  id: string;
  title: string;
  view: string;
}

export interface ComponentTemplate {
  id: string;
  title: string;
  view: string;
}

export interface Content {
  [key: string]: any;
}

export interface Component {
  id: string;
  title: string;
  schemaId?: string;
  publicationId: number;
  lastPublishedDate?: string;
  modifiedDate?: string;
  resolvedLink?: string;
  componentTemplate?: ComponentTemplate;
  componentCustomMetadata?: CustomMetadata;
  content?: Content;
}

export interface Components {
  components: Component[];
  total?: number;
}

export interface CustomMetadata {
  [key: string]: any;
}

export interface Region { 
  name: string;
  components: Component[];
}

export interface Base {
  id: number;
  publicationId: number;
  locale: string;
  url: string;
  description?: string;
  title: string;
  pageTemplate?: PageTemplate;
  components?: Component[];
  regions?: Region[];
  pageCustomMetadata?: CustomMetadata;
  isDefaultHeader?: boolean;
  isDefaultFooter?: boolean;
  header?: string;
  footer?: string;
}

export interface NavigationPage {
  id: number;
  publicationId: number;
  title: string;
  url: string;
  hiddenPage: boolean;
  lastPublishedDate: Date;
  includeInSitemap?: boolean;
  includeInBreadcrumb?: boolean;
  includeInTopNavigation?: boolean;
  topNavigationTitle?: string;
  titleForSorting?: string;
  menuLink?: Link;
  extraInfos?: NavigationCard[];
}

export interface NavigationCard {
  cardText: string;
  media: {
    imageUrl: string;
    altText: string;
  };
  link: Link;
}

export interface Link { 
  linkText: string;
  linkUrl?: string;
  openInNewWindow?: Boolean;
}

export interface NavigationFolder {
  id: number;
  url: string;
  topNavigationTitle?: string;
  titleForSorting?: string;
  includeInSitemap?: boolean;
  includeInBreadcrumb?: boolean;
  includeInTopNavigation?: boolean;
  children: NavigationItem[];
  extraInfos?: NavigationCard[];
}

export type NavigationItem = NavigationFolder | NavigationPage;
