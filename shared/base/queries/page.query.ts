import { gql } from 'graphql-tag';

export const GET_PAGE = gql`
  query GetPage($namespaceId: Int!, $publicationId: Int!, $url: String!) {
    page(namespaceId: $namespaceId, publicationId: $publicationId, url: $url) {
      id
      itemId
      publicationId
      title
      url
      pageTemplate {
        itemId
        title
      }
      regions {
        name
        components {
          title
          ... on Component {
            itemId
            title
            schemaId
            resolvedLink {
              type
              url
            }
            customMetas {
              edges {
                node {
                  key
                  value
                  valueType
                }
              }
            }
            content {
              ... on UntypedContent {
                data
              }
            }
          }
        }
      }
      components {
        title
        ... on Component {
          itemId
          title
          schemaId
          resolvedLink {
            type
            url
          }
          customMetas {
            edges {
              node {
                key
                value
                valueType
              }
            }
          }
          content {
            ... on UntypedContent {
              data
            }
          }
        }
      }
      customMetas {
        edges {
          node {
            key
            value
            valueType
          }
        }
      }
    }
  }
`;

export const GET_PAGE_METADATA = gql`
  query GetPageMetadata($namespaceId: Int!, $publicationId: Int!, $url: String!) {
    page(namespaceId: $namespaceId, publicationId: $publicationId, url: $url) {
      id
      itemId
      publicationId
      title
      url
      customMetas {
        edges {
          node {
            key
            value
            valueType
          }
        }
      }
    }
  }
`;

export const GET_ALL_PAGES = gql`
  query GetAllPages($publicationId: Int!) {
    items(filter: { itemTypes: [PAGE], publicationIds: [$publicationId] }) {
      edges {
        node {
          title
          creationDate
          itemType
          ... on Page {
            itemId
            title
            url
            lastPublishDate
            customMetas {
              edges {
                node {
                  key
                  value
                }
              }
            }
            regions {
              components {
                id
                title
                ... on Component {
                  schemaId
                  content {
                    ... on UntypedContent {
                      data
                    }
                  }
                }
              }
            }
            components {
              id
              title
              ... on Component {
                schemaId
                content {
                  ... on UntypedContent {
                    data
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const GET_ALL_STRUCTURE_GROUPS = gql`
  query GetAllStructureGroups($namespaceId: Int!, $publicationId: Int!, $structureGroupId: Int!) {
    structureGroup(namespaceId: $namespaceId, publicationId: $publicationId, structureGroupId: $structureGroupId) {
      itemId
      title
      directory
      children {
        edges {
          node {
            itemId
            title
            ... on StructureGroup {
              directory
              children {
                edges {
                  node {
                    itemId
                    title
                    ... on StructureGroup {
                      directory
                      children {
                        edges {
                          node {
                            itemId
                            title
                            ... on StructureGroup {
                              directory
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;