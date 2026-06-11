import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { CachingService } from '../../common/caching/caching.service';
import { CacheTypes } from '../../common/enums/caching.enum';
import { BaseService } from '../base.service';
import * as CONSTANTS from '../../constants';
import { TridionService } from '../../common/graphql/tridion.service';
import { GET_ALL_PAGES, GET_ALL_STRUCTURE_GROUPS } from '../queries/page.query';
import {
  CustomMetadata,
  NavigationItem,
  NavigationFolder,
  NavigationPage
} from '../interfaces/base.interface';
import { UtilsService } from '../../common/utils/utils.service';
// import { CronJob } from 'cron';

@Injectable()
export class NavigationService {
  constructor(
    private readonly baseService: BaseService,
    private readonly logger: Logger,
    private readonly cachingService: CachingService,
    private readonly tridionService: TridionService,
    private readonly utilService: UtilsService,
  ) { }

  SERVICE: string = NavigationService.name;

  async initialize(): Promise<void> {
    try {
      await this.loadNavigations();
      this.logger.log('Navigations cache initialized');
    } catch (error) {
      this.logger.error(
        `Initialization failed: ${error.message}`,
        error.stack,
        this.SERVICE,
      );
      throw new InternalServerErrorException('Failed to initialize navigations');
    }
  }

  // async initialize() {
  //   try {
  //     await this.loadNavigations();

  //     const baseInterval = this.utilService.getNavigationCacheTtlForCronJob();
  //     const jitter = Math.floor(Math.random() * 5 * 60 * 1000);
  //     const cronInterval = baseInterval + jitter;

  //     const cronExpression = this.utilService.convertMillisecondsToCron(cronInterval);

  //     new CronJob(cronExpression, async () => {
  //       try {
  //         await this.loadNavigations();
  //       } catch (error) {
  //         this.logger.error("Error during cron job execution", error.stack);
  //       }
  //     }).start();
  //   } catch (error) {
  //     this.logger.error(`Error in OnApplicationBootstrap`, error.stack, this.SERVICE);
  //     throw new InternalServerErrorException(`Error during OnApplicationBootstrap`);
  //   }
  // }

  private async convertNavigationData(
    navigationData: any,
    structureGroupData: any,
    localization: any,
  ): Promise<NavigationItem> {
    try {
      this.logger.debug(`Converting Navigation data for: ${localization.path}`, this.SERVICE);

      const allPages: NavigationPage[] = [];
      
      await Promise.all(
        navigationData.data.items.edges.map(async (edge: any) => {
          const page: NavigationPage = {
            publicationId: localization.publicationId,
            id: edge.node.itemId,
            title: edge.node.title,
            url: edge.node.url,
            hiddenPage: false,
            lastPublishedDate: edge.node.lastPublishDate,
            includeInSitemap: true,
            includeInBreadcrumb: true,
            includeInTopNavigation: true
          };
  
          // Directly search for navigationTitle or pageTitle in the JSON structure
          const navigationTitle = edge.node.regions
            .flatMap((reg: any) => reg.components)
            .reduce((acc: string, comp: any) => {
              if (comp?.content?.data?.navigationTitle) {
                return comp.content.data.navigationTitle;
              }
              return acc;
            }, '');

          const pageTitle = edge.node.regions
            .flatMap((reg: any) => reg.components)
            .reduce((acc: string, comp: any) => {
              if (comp?.content?.data?.pageTitle) {
                return comp.content.data.pageTitle;
              }
              return acc;
            }, '');

          // CustomMetas edges node key="title" value
          const title_customMeta = edge.node.customMetas?.edges?.find(cm => cm.node.key === 'title')?.node?.value;

          // Set topNavigationTitle based on priority: navigationTitle > pageTitle > edge.node.title
          page.topNavigationTitle = navigationTitle || pageTitle || title_customMeta || edge.node.title;

          this.fetchNavigationValues(
            await this.baseService.processCustomMetadataAsync(edge.node.customMetas?.edges || []),
            page,
            localization.path
          );
  
          page.topNavigationTitle ||= page.title; // Fallback to page title if not set
          allPages.push(page);
        })
      );

      return this.buildNavigation(allPages, structureGroupData, localization.path);
    } catch (error) {
      this.logger.error(`Error converting navigation data for: ${localization.path}`, error.stack, this.SERVICE);
      throw new InternalServerErrorException(
        `Error converting navigation data for: ${localization.path} pubId ${localization.publicationId}`
      );
    }
  }

  async fetchNavigationValues(pageCustomMetadata: CustomMetadata, page: NavigationPage, localeUrl: string){
    page.hiddenPage = pageCustomMetadata['hiddenPage'] === 'Yes' ? true : page.hiddenPage;
    page.includeInSitemap = pageCustomMetadata['includeInSitemap'] === 'No' ? false : page.includeInSitemap;
    page.includeInBreadcrumb = pageCustomMetadata['includeInBreadcrumb'] === 'No' ? false : page.includeInBreadcrumb;
    page.includeInTopNavigation = pageCustomMetadata['includeInTopNavigation'] === 'No' ? false : page.includeInTopNavigation;
    
    if (pageCustomMetadata["externalLink"]) {
      const { linkedData } = pageCustomMetadata["externalLink"];
      const { menuItemLink } = linkedData || {};
    
      page.menuLink = {
        linkText: menuItemLink?.linkText ?? "",
        openInNewWindow: menuItemLink?.linkTarget?.title === 'Yes',
        linkUrl: menuItemLink?.externalLink ?? menuItemLink?.internalLink?.linkedUrl
      };

      // Adding locale to relative URLs
      if (page.menuLink?.linkUrl?.startsWith('/')) {
        page.menuLink.linkUrl = `${localeUrl}${page.menuLink.linkUrl}`;
      }
    }

    page.extraInfos = pageCustomMetadata.extraInfoCards?.linkedData?.navigationCard?.$values?.map((item) => ({
      cardText: item.linkedData?.cardText ?? "",
      media: {
        imageUrl: item.linkedData?.media?.variants?.edges?.[0]?.node?.url ?? "",
        altText: item.linkedData?.media?.title ?? "",
      },
      link: {
        linkUrl: item.linkedData?.link?.internalLink?.linkedUrl ?? item.linkedData?.link?.externalLink ?? "",
        openInNewWindow: item.linkedData?.link?.linkTarget?.title === "Yes",
      },
    }));
  }

  async loadNavigations(): Promise<void> {
    let cachedLocalizations = await this.cachingService.getFromCache(CacheTypes.LOCALIZATION);
  
    if (!cachedLocalizations || cachedLocalizations.length === 0) {
      this.logger.warn(
        `${CONSTANTS.ERROR_LOCALIZATIONS_NOT_FOUND}, try reload from CMS`,
      );

      await this.baseService.loadLocalizations();

      cachedLocalizations = await this.cachingService.getFromCache(CacheTypes.LOCALIZATION);

      if (!cachedLocalizations || cachedLocalizations.length === 0) {
        this.logger.error(
          `Reload localization failed, skip header/footer preload`,
        );
        return;
      }
    }

    await Promise.all(
      cachedLocalizations.map(async (localization: any) => {
        await this.loadNavigationByLocale(localization.path);
      }),
    );
  }

  async loadNavigationByLocale(path: string): Promise<void> {
    this.logger.debug(`Loading navigation for locale: ${path}`, this.SERVICE);

    const publicationId = await this.baseService.getPublicationIdByLocale(path);

    const navigationJson = await this.fetchNavigationFromTridion(publicationId);
    const structureGroupJson = await this.fetchStructureGroupsFromTridion(publicationId);

    const localization = {
      path: path,
      publicationId: publicationId
    };
  
    const navigation = await this.convertNavigationData(
      navigationJson,
      structureGroupJson,
      localization,
    );
  
    await this.cachingService.putIntoCache(CacheTypes.NAVIGATION, {
      url: path,
      payload: navigation,
    });
  }

  async fetchNavigationFromTridion(pubId: number): Promise<any> {
    const variables = {
      namespaceId: 1,
      publicationId: pubId,
    };

    const response = await this.tridionService.query(GET_ALL_PAGES, variables);
    return response;
  }

  async fetchStructureGroupsFromTridion(pubId: number): Promise<any> {
    const variables = {
      namespaceId: 1,
      publicationId: pubId,
      structureGroupId: 5
    };

    const response = await this.tridionService.query(GET_ALL_STRUCTURE_GROUPS, variables);
    return response;
  }

  async getNavigation(path: string): Promise<any> {
    const normalizedUrl = this.baseService.ensureLeadingSlash(path);
  
    let navigation = await this.cachingService.getFromCache(
      CacheTypes.NAVIGATION,
      normalizedUrl,
    );
  
    if (navigation) {
      return navigation;
    }
  
    this.logger.warn(`Navigation cache miss for ${normalizedUrl}`);
  
    try {
      await this.loadNavigationByLocale(normalizedUrl);
    } catch (error) {
      this.logger.error(`Failed to load navigation for ${normalizedUrl}`, error.stack);
      throw new InternalServerErrorException(`Failed to load navigation for ${normalizedUrl}`);
    }
  
    return this.cachingService.getFromCache(
      CacheTypes.NAVIGATION,
      normalizedUrl,
    );
  }

  // Build a hierarchy from a list of pages
  buildNavigation(pages: NavigationPage[], structureGroupData: any, localeUrl: string): NavigationFolder {
    const pageMap: Record<string, NavigationPage> = Object.fromEntries(pages.map(p => [p.url, p]));
    const root: NavigationFolder = {
      id: 0,
      url: localeUrl,
      children: [],
      titleForSorting: 'Home'
    };
    const folderMap: Record<string, NavigationFolder> = { [localeUrl]: root };

    // 1. First build folder hierarchy from page URLs (this is what creates the folder structure)
    pages.forEach(page => {
      if (!page.url.startsWith(localeUrl)) return;

      const parts = page.url.slice(localeUrl.length).split('/').filter(Boolean);
      let currentPath = localeUrl;

      parts.forEach((part, index) => {
        const isLastPart = index === parts.length - 1;

        // Only create folders for non-last parts (directory paths)
        if (!isLastPart) {
          const nextPath = `${currentPath}/${part}`;

          // Check if we need to create this folder
          if (!folderMap[nextPath]) {
            folderMap[nextPath] = {
              id: 0,
              url: nextPath,
              children: [],
              titleForSorting: ''
            };

            // Add this folder to its parent's children
            const parentFolder = folderMap[currentPath];
            if (parentFolder) {
              // Check if folder already exists in parent's children
              const folderExists = parentFolder.children.some(
                child => 'url' in child && (child as NavigationFolder).url === nextPath
              );
              if (!folderExists) {
                parentFolder.children.push(folderMap[nextPath]);
              }
            }
          }

          currentPath = nextPath;
        } else {
          // This is a page (last part of URL)
          // Add page to its parent folder's children
          const parentFolder = folderMap[currentPath];
          if (parentFolder) {
            // Check if page already exists
            const pageExists = parentFolder.children.some(
              child => 'url' in child && child.url === page.url
            );
            if (!pageExists) {
              parentFolder.children.push(page);
            }
          }
        }
      });
    });

    // 2. Create a map of structure group paths to their titles using FULL PATH
    const structureGroupPathMap: Record<string, { title: string, itemId: string }> = {};

    const buildStructureGroupPathMap = (edges: any[], currentPath: string = '') => {
      edges.forEach(edge => {
        const node = edge.node;

        // Build the FULL path including parent directories
        let sgPath = node.directory;
        if (currentPath) {
          sgPath = `${currentPath}/${node.directory}`;
        }

        // Only store if we have a valid path
        if (sgPath) {
          structureGroupPathMap[sgPath] = {
            title: node.title,
            itemId: node.itemId
          };
        }

        // Recursively process children
        if (node.children?.edges?.length > 0) {
          buildStructureGroupPathMap(node.children.edges, sgPath);
        }
      });
    };

    // Process ALL structure groups starting from root
    if (structureGroupData?.data?.structureGroup?.children?.edges) {
      buildStructureGroupPathMap(structureGroupData.data.structureGroup.children.edges);
    }

    // 3. Update folders with structure group information
    Object.entries(structureGroupPathMap).forEach(([sgPath, sgInfo]) => {
      // Convert structure group path to URL
      const folderUrl = sgPath ? `${localeUrl}/${sgPath}` : localeUrl;

      const folder = folderMap[folderUrl];
      if (folder) {
        // Update existing folder with structure group info
        folder.titleForSorting = sgInfo.title;
        folder.id = parseInt(sgInfo.itemId, 10) || folder.id;
      } else {
        // Create missing folder from structure group
        folderMap[folderUrl] = {
          id: parseInt(sgInfo.itemId, 10),
          url: folderUrl,
          children: [],
          titleForSorting: sgInfo.title
        };

        // Find and set parent
        const parts = sgPath.split('/').filter(Boolean);
        if (parts.length > 1) {
          // Remove last part to get parent path
          const parentPath = parts.slice(0, -1).join('/');
          const parentUrl = parentPath ? `${localeUrl}/${parentPath}` : localeUrl;

          let parentFolder = folderMap[parentUrl];
          if (!parentFolder) {
            // Create parent folder if it doesn't exist
            parentFolder = {
              id: 0,
              url: parentUrl,
              children: [],
              titleForSorting: ''
            };
            folderMap[parentUrl] = parentFolder;

            // Add parent to its parent (recursively create hierarchy)
            if (parentUrl !== localeUrl) {
              const grandParentPath = parentUrl.slice(0, parentUrl.lastIndexOf('/'));
              const grandParentFolder = folderMap[grandParentPath] || root;
              grandParentFolder.children.push(parentFolder);
            } else {
              root.children.push(parentFolder);
            }
          }

          parentFolder.children.push(folderMap[folderUrl]);
        } else if (sgPath) {
          // Top-level folder, parent is root
          root.children.push(folderMap[folderUrl]);
        }
      }
    });

    // 4. Process each folder to copy index page metadata and ensure titleForSorting
    Object.values(folderMap).forEach(folder => {
      // Check for index page
      const indexPage = pageMap[`${folder.url}/index.html`];
      if (indexPage) {
        // Move fields from index page to folder
        folder.topNavigationTitle = indexPage.topNavigationTitle;
        folder.includeInBreadcrumb = indexPage.includeInBreadcrumb;
        folder.includeInSitemap = indexPage.includeInSitemap;
        folder.includeInTopNavigation = indexPage.includeInTopNavigation;

        // Move extraInfos from index page to folder
        if (indexPage.extraInfos) {
          folder.extraInfos = indexPage.extraInfos;
        }

        // Remove ONLY the index page that corresponds to this folder from children
        folder.children = folder.children.filter(child => {
          if ('url' in child && child.url === `${folder.url}/index.html`) {
            return false; // Remove this specific index page
          }
          return true;
        });
      }

      // Ensure folder has a titleForSorting
      if (!folder.titleForSorting) {
        if (folder.url === localeUrl) {
          folder.titleForSorting = 'Home';
        } else {
          // Fallback: use the last part of the URL path
          const folderName = folder.url.split('/').pop() || '';
          folder.titleForSorting = folderName
            .replace(/\.html$/, '')
            .replace(/-/g, ' ')
            .replace(/^\w/, c => c.toUpperCase());
        }
      }

      // Sort children within each folder
      folder.children.sort((a, b) => {
        // Helper to get sortable title
        const getSortTitle = (item: NavigationFolder | NavigationPage): string => {
          if ('children' in item) {
            // Folder
            const folderItem = item as NavigationFolder;
            return folderItem.titleForSorting || folderItem.topNavigationTitle || '';
          } else {
            // Page
            const pageItem = item as NavigationPage;
            return pageItem.titleForSorting || pageItem.title || '';
          }
        };

        // Check if item is a folder (folders come before pages)
        const isAFolder = 'children' in a;
        const isBFolder = 'children' in b;

        if (isAFolder && !isBFolder) return -1;
        if (!isAFolder && isBFolder) return 1;

        // Get sort titles
        const titleA = getSortTitle(a);
        const titleB = getSortTitle(b);

        // Extract numeric prefix (1-5 digits at the start)
        const getNumericPrefix = (title: string): number => {
          if (!title) return 999999; // High number for items without prefix
          const match = title.match(/^(\d{1,5})/); // Allow 1-5 digits
          return match ? parseInt(match[1], 10) : 999999;
        };

        const numA = getNumericPrefix(titleA);
        const numB = getNumericPrefix(titleB);

        // Sort by numeric prefix
        if (numA !== numB) {
          return numA - numB;
        }

        // If same numeric prefix or no numeric prefix, sort alphabetically
        // But prioritize items with numeric prefixes over those without
        if (numA !== 999999 && numB === 999999) return -1;
        if (numA === 999999 && numB !== 999999) return 1;

        return titleA.localeCompare(titleB);
      });
    });

    // 5. Sort ALL folders recursively (folders at each level)
    const sortFolderContents = (folder: NavigationFolder): void => {
      // Sort this folder's children (already done above, but ensure folders are properly sorted)
      folder.children.sort((a, b) => {
        // Helper to get sortable title
        const getSortTitle = (item: NavigationFolder | NavigationPage): string => {
          if ('children' in item) {
            // Folder
            const folderItem = item as NavigationFolder;
            return folderItem.titleForSorting || folderItem.topNavigationTitle || '';
          } else {
            // Page
            const pageItem = item as NavigationPage;
            return pageItem.titleForSorting || pageItem.title || '';
          }
        };

        // Check if item is a folder (folders come before pages)
        const isAFolder = 'children' in a;
        const isBFolder = 'children' in b;

        if (isAFolder && !isBFolder) return -1;
        if (!isAFolder && isBFolder) return 1;

        // Get sort titles
        const titleA = getSortTitle(a);
        const titleB = getSortTitle(b);

        // Extract numeric prefix (1-5 digits at the start)
        const getNumericPrefix = (title: string): number => {
          if (!title) return 999999;
          const match = title.match(/^(\d{1,5})/);
          return match ? parseInt(match[1], 10) : 999999;
        };

        const numA = getNumericPrefix(titleA);
        const numB = getNumericPrefix(titleB);

        // Sort by numeric prefix
        if (numA !== numB) {
          return numA - numB;
        }

        // Prioritize items with numeric prefixes
        if (numA !== 999999 && numB === 999999) return -1;
        if (numA === 999999 && numB !== 999999) return 1;

        return titleA.localeCompare(titleB);
      });

      // Recursively sort subfolders
      folder.children.forEach(child => {
        if ('children' in child) {
          sortFolderContents(child as NavigationFolder);
        }
      });
    };

    // Start sorting from root
    sortFolderContents(root);

    return root;
  }

    // Method to get parent URL from a given URL
    private getParentUrl(url: string): string {
      const segments = url.split('/').filter(segment => segment.length > 0);
      if (segments.length > 1) {
        segments.pop(); // Remove the last segment (file name or last folder)
      }
      return '/' + segments.join('/');
    }
  
    // Helper method to parse NNN prefix from title
    private parseNNN(title: string): number {
      const match = title.match(/^\d{3}/);
      return match ? parseInt(match[0], 10) : 999;
    }
}