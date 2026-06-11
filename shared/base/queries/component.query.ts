import { gql } from 'graphql-tag';

export const GET_COMPONENT = gql`
  query GetComponent($namespaceId: Int!, $publicationId: Int!, $componentId: Int!) {
    component(namespaceId: $namespaceId, publicationId: $publicationId, componentId: $componentId) {
      id
      itemId
      title
      schemaId
      publicationId
      resolvedLink {
        type
        url
      }
      content {
        ... on UntypedContent {
          data
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

export const GET_COMPONENT_METADATA = gql`
  query GetComponentMetadata($namespaceId: Int!, $publicationId: Int!, $componentId: Int!) {
    component(namespaceId: $namespaceId, publicationId: $publicationId, componentId: $componentId) {
      id
      itemId
      title
      schemaId
      publicationId
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

export const GET_COMPONENT_LIST = gql`
  query GetComponentList($publicationIds: [Int!]!, $itemTypes: [FilterItemType!]!) {
    items(filter: { publicationIds: $publicationIds, itemTypes: $itemTypes }) {
      edges {
        node {
          id
          itemId
          title
          publicationId
          ... on Component {
            schemaId
            resolvedLink {
              type
              url
            }
            content {
              ... on UntypedContent {
                data
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
      }
    }
  }
`;

export const GET_COMPONENT_LIST2 = gql`
  query GetComponentList2($publicationIds: [Int!]!, $schema: InputSchemaCriteria!) {
    items(filter: { publicationIds: $publicationIds, schema: $schema }) {
      edges {
        node {
          id
          itemId
          title
          publicationId
          ... on Component {
            schemaId
            resolvedLink {
              type
              url
            }
            content {
              ... on UntypedContent {
                data
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
      }
    }
  }
`;

export const GET_COMPONENT_LIST_BY_TYPE = gql`
  query ComponentsByType(
    $first: Int!
    $after: String!
    $inputItemFilter: InputItemFilter!
    $inputSortParam: InputSortParam!
  ) {
    items(first: $first, after: $after, filter: $inputItemFilter, sort: $inputSortParam) {
      edges {
        node {
          __typename
          itemId
          itemType
          title
          creationDate
          publicationId
          owningPublicationId
          updatedDate
          lastPublishDate

          ... on Component {
            schemaId
            resolvedLink {
              type
              url
            }
            content {
              ... on UntypedContent {
                data
              }
            }

            customMetas {
              edges {
                node {
                  key
                  id
                  itemId
                  namespaceId
                  publicationId
                  value
                  valueType
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const GET_COMPONENT_TOTAL_NUMBER_BY_TYPE = gql`
  query TotalComponentsByType(
    $inputItemFilter: InputItemFilter!
  ) {
    items(filter: $inputItemFilter) {
      edges {
        node {
          id
          itemId
          title
          lastPublishDate
        }
      }
    }
  }
`;

export const GET_COMPONENT_LIST_BY_TYPE2 = gql`
  query ComponentsByType(
    $first: Int!
    $after: String
    $inputItemFilter: InputItemFilter!
    $inputSortParam: InputSortParam!
  ) {
    items(first: $first, after: $after, filter: $inputItemFilter, sort: $inputSortParam) {
      edges {
        node {
          __typename
          itemId
          itemType
          title
          creationDate
          publicationId
          owningPublicationId
          updatedDate
          lastPublishDate

          ... on Component {
            schemaId
            resolvedLink {
              type
              url
            }
            content {
              ... on UntypedContent {
                data
              }
            }

            customMetas {
              edges {
                node {
                  key
                  itemId
                  namespaceId
                  publicationId
                  value
                  valueType
                }
              }
            }
          }
        }
      }
    }
  }
`;
