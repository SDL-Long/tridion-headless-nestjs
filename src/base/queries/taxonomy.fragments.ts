import { gql } from 'graphql-tag';

export const KeywordFieldsLevel3 = gql`
  fragment KeywordFieldsLevel3 on Keyword {
    id
    itemId
    title
    key
    description
    itemType
    hasChildren
    parent {
      id
      itemId
      taxonomyId
      title
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
`;

export const KeywordFieldsLevel2 = gql`
  fragment KeywordFieldsLevel2 on Keyword {
    id
    itemId
    title
    key
    description
    itemType
    hasChildren
    parent {
      id
      itemId
      taxonomyId
      title
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
    children {
      edges {
        node {
          ...KeywordFieldsLevel3
        }
      }
    }
  }
  ${KeywordFieldsLevel3}
`;

export const KeywordFieldsLevel1 = gql`
  fragment KeywordFieldsLevel1 on Keyword {
    id
    itemId
    title
    key
    description
    itemType
    hasChildren
    parent {
      id
      itemId
      taxonomyId
      title
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
    children {
      edges {
        node {
          ...KeywordFieldsLevel2
        }
      }
    }
  }
  ${KeywordFieldsLevel2}
`;
