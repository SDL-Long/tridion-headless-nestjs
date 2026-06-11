import { gql } from 'graphql-tag';

export const GET_BINARY_COMPONENT = gql`
  query GetBinaryComponent($namespaceId: Int!, $cmUri: String!) {
    binaryComponent(namespaceId: $namespaceId, cmUri: $cmUri) {
      id
      itemId
      schemaId
      title
      itemType
      publicationId
      lastPublishDate
      updatedDate
      customMetas {
        edges {
          node {
            key
            value
          }
        }
      }
      variants {
        edges {
          node {
            id
            binaryId
            description
            path
            type
            url
          }
        }
      }
    }
  }
`;

export const GET_BINARY_COMPONENT_BY_URL = gql`
  query GetBinaryComponentByUrl($namespaceId: Int!, $publicationId: Int!, $url: String!) {
    binaryComponent(namespaceId: $namespaceId, publicationId: $publicationId, url: $url) {
      id
      itemId
      schemaId
      title
      itemType
      publicationId
      lastPublishDate
      updatedDate
      customMetas {
        edges {
          node {
            key
            value
          }
        }
      }
      variants {
        edges {
          node {
            id
            binaryId
            description
            downloadUrl
            path
            type
            url
          }
        }
      }
    }
  }
`;

export const GET_BINARY_COMPONENT_BY_ID = gql`
  query GetBinaryComponentById($namespaceId: Int!, $publicationId: Int!, $binaryId: Int!) {
    binaryComponent(namespaceId: $namespaceId, publicationId: $publicationId, binaryId: $binaryId) {
      id
      itemId
      schemaId
      title
      itemType
      publicationId
      lastPublishDate
      updatedDate
      customMetas {
        edges {
          node {
            key
            value
          }
        }
      }
      variants {
        edges {
          node {
            id
            binaryId
            description
            downloadUrl
            path
            type
            url
          }
        }
      }
    }
  }
`;

export const GET_BINARY_COMPONENT_LAST_PUBLISH_DATE_BY_URL = gql`
  query GetBinaryComponentLastPublishDateByUrl(
    $namespaceId: Int!
    $publicationId: Int!
    $url: String!
  ) {
    binaryComponent(namespaceId: $namespaceId, publicationId: $publicationId, url: $url) {
      id
      itemId
      title
      publicationId
      lastPublishDate
      updatedDate
    }
  }
`;

export const GET_BINARY_COMPONENT_LAST_PUBLISH_DATE_BY_ID = gql`
  query GetBinaryComponentLastPublishDateById(
    $namespaceId: Int!
    $publicationId: Int!
    $binaryId: Int!
  ) {
    binaryComponent(namespaceId: $namespaceId, publicationId: $publicationId, binaryId: $binaryId) {
      id
      itemId
      title
      publicationId
      lastPublishDate
      updatedDate
    }
  }
`;
