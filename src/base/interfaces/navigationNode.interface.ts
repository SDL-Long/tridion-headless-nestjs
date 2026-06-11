export interface NavigationNode {
    url: string;
    lastPublishedDate?: string;
    includeInSitemap?: boolean;
    children?: NavigationNode[];
}