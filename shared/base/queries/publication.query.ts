import { gql } from 'graphql-tag';

export const GET_PUBLICATION_MAPPING = gql`
  query GetPublicationMapping($namespaceId: Int!, $siteUrl: String!) {
    publicationMapping(namespaceId: $namespaceId, siteUrl: $siteUrl) {
      domain
      port
      path
      publicationId
    }
  }
`;

export const GET_ALL_PUBLICATION_MAPPINGS = gql`
  query GetPublicationMappings($namespaceId: Int!) {
    publicationMappings(namespaceId: $namespaceId) {
      edges {
        node {
          domain
          namespaceId
          path
          port
          protocol
          publicationId
          pathScanDepth
        }
      }
    }
  }
`;
