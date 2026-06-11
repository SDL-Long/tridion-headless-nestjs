import { gql } from 'graphql-tag';

export const GET_LABELS = gql`
  query GetLabels($publicationIds: [Int!]!, $itemTypes: [FilterItemType!]!) {
    items(filter: { publicationIds: $publicationIds, itemTypes: $itemTypes }) {
      edges {
        node {
          id
          itemId
          title
          ... on Component {
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
`;
