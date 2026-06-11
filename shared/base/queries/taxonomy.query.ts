import { gql } from 'graphql-tag';
import { KeywordFieldsLevel1 } from './taxonomy.fragments';

export const GET_SPECIFIC_CATEGORY_WITHOUT_KEYWORD_BY_ID = gql`
  query GetSpecificCategoryWithoutKeywordById($publicationId: Int!, $categoryId: Int!) {
    category(namespaceId: 1, publicationId: $publicationId, categoryId: $categoryId) {
      id
      itemId
      title
      key
      description
      itemType
      hasChildren
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

export const GET_SPECIFIC_CATEGORY_WITHOUT_KEYWORD_BY_NAME = gql`
  query GetSpecificCategoryWithoutKeywordByName($publicationId: Int!, $categoryName: String!) {
    category(namespaceId: 1, publicationId: $publicationId, categoryName: $categoryName) {
      id
      itemId
      title
      key
      description
      itemType
      hasChildren
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

export const GET_ALL_CATEGORY_WITHOUT_KEYWORD = gql`
  query GetAllCategoriesWithoutKeyword($publicationId: Int!) {
    categories(namespaceId: 1, publicationId: $publicationId) {
      edges {
        node {
          id
          itemId
          itemType
          description
          key
          title
          hasChildren
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
`;

export const GET_ALL_CATEGORY_AND_KEYWORD = gql`
  query GetAllCategoriesAndKeywords($publicationId: Int!) {
    categories(namespaceId: 1, publicationId: $publicationId) {
      edges {
        node {
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
            taxonomyType
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
                ...KeywordFieldsLevel1
              }
            }
          }
        }
      }
    }
  }
  ${KeywordFieldsLevel1}
`;

// fetch three layers
export const GET_SPECIFIC_CATEGORY_WITH_KEYWORD_BY_ID = gql`
  query GetSpecificCategoryWithKeywordsById($publicationId: Int!, $categoryId: Int!) {
    category(namespaceId: 1, publicationId: $publicationId, categoryId: $categoryId) {
      id
      itemId
      title
      key
      description
      itemType
      hasChildren
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
            ...KeywordFieldsLevel1
          }
        }
      }
    }
  }
  ${KeywordFieldsLevel1}
`;

// fetch first level
export const GET_SPECIFIC_CATEGORY_WITH_FIRST_LEVEL_KEYWORD_BY_ID = gql`
  query GetSpecificCategoryWithKeywordsById($publicationId: Int!, $categoryId: Int!) {
    category(namespaceId: 1, publicationId: $publicationId, categoryId: $categoryId) {
      id
      itemId
      title
      key
      description
      itemType
      hasChildren
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
            ...KeywordFieldsLevel1ForSpecificCategoryWithKeywordsById
          }
        }
      }
    }
  }

  fragment KeywordFieldsLevel1ForSpecificCategoryWithKeywordsById on Keyword {
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
  }
`;

export const GET_SPECIFIC_CATEGORY_WITH_KEYWORD_BY_NAME = gql`
  query GetSpecificCategoryWithKeywordsByName($publicationId: Int!, $categoryName: String!) {
    category(namespaceId: 1, publicationId: $publicationId, categoryName: $categoryName) {
      id
      itemId
      title
      key
      description
      itemType
      hasChildren
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
            ...KeywordFieldsLevel1
          }
        }
      }
    }
  }
  ${KeywordFieldsLevel1}
`;

// fetch first level
export const GET_SPECIFIC_CATEGORY_WITH_FIRST_LEVEL_KEYWORD_BY_NAME = gql`
  query GetSpecificCategoryWithKeywordsByName($publicationId: Int!, $categoryName: String!) {
    category(namespaceId: 1, publicationId: $publicationId, categoryName: $categoryName) {
      id
      itemId
      title
      key
      description
      itemType
      hasChildren
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
            ...KeywordFieldsLevel1ForSpecificCategoryWithKeywordsByName
          }
        }
      }
    }
  }

  fragment KeywordFieldsLevel1ForSpecificCategoryWithKeywordsByName on Keyword {
    id
    itemId
    title
    key
    description
    itemType
    hasChildren
    customMetas {
      edges {
        node {
          key
          value
          valueType
        }
      }
    }
    parent {
      id
      itemId
      taxonomyId
      title
    }
  }
`;

export const GET_SPECIFIC_KEYWORD_WITH_FIRST_LEVLE_CHILDREN = gql`
  query GetSpecificKeywordWithFirstLevelChildren(
    $publicationId: Int!
    $categoryId: Int!
    $keywordId: Int!
  ) {
    keyword(
      namespaceId: 1
      publicationId: $publicationId
      categoryId: $categoryId
      keywordId: $keywordId
    ) {
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
            ...KeywordFieldsLevel1ForSpecificKeywordWithFirstLevelChildren
          }
        }
      }
    }
  }

  fragment KeywordFieldsLevel1ForSpecificKeywordWithFirstLevelChildren on Keyword {
    id
    itemId
    title
    key
    description
    itemType
    hasChildren
    customMetas {
      edges {
        node {
          key
          value
          valueType
        }
      }
    }
    parent {
      id
      itemId
      taxonomyId
      title
    }
  }
`;

export const GET_SPECIFIC_KEYWORD = gql`
  query GetSpecificKeywordById($publicationId: Int!, $categoryId: Int!, $keywordId: Int!) {
    keyword(
      namespaceId: 1
      publicationId: $publicationId
      categoryId: $categoryId
      keywordId: $keywordId
    ) {
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
            ...KeywordFieldsLevel1
          }
        }
      }
    }
  }
  ${KeywordFieldsLevel1}
`;

export const GET_SPECIFIC_KEYWORD_WITHOUT_CHILDREN = gql`
  query GetSpecificKeywordWithoutChildren(
    $publicationId: Int!
    $categoryId: Int!
    $keywordId: Int!
  ) {
    keyword(
      namespaceId: 1
      publicationId: $publicationId
      categoryId: $categoryId
      keywordId: $keywordId
    ) {
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
  }
`;
