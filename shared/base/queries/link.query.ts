import { gql } from 'graphql-tag';

export const GET_COMPONENT_LINK = gql`
  query GetComponentLink($namespaceId: Int!, $publicationId: Int!, $componentId: Int!) {
    component(namespaceId: $namespaceId, publicationId: $publicationId, componentId: $componentId) {
      title
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
    }
  }
`;

export const GET_COMPONENT_LINK2 = gql`
  query GetComponentLink2(
    $namespaceId: Int!
    $publicationId: Int!
    $sourcePageId: Int!
    $targetComponentId: Int!
  ) {
    componentLink(
      namespaceId: $namespaceId
      publicationId: $publicationId
      sourcePageId: $sourcePageId
      targetComponentId: $targetComponentId
    ) {
      itemId
      url
    }
  }
`;
