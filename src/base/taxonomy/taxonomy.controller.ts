import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { TaxonomyService } from './taxonomy.service';
import { Categories, Keyword } from '../interfaces/taxonomy.interface';
import {
  BaseTaxonomyDto,
  CategoryChildrenFlatDto,
  KeywordChildrenFlatDto,
} from '../dto/taxonomy.dto';
import { ApiResponses } from '../../common/swagger/api-responses.decorator';

@Controller('api')
export class TaxonomyController {
  constructor(private readonly taxonomyService: TaxonomyService) {}

  @Get('/categories')
  @ApiOperation({ summary: 'Get all categories without keywords' })
  @ApiResponses()
  async getAllCategories(@Query() taxonomyDto: BaseTaxonomyDto): Promise<Categories> {
    const data = await this.taxonomyService.getAllCategoriesWithoutKeyword(taxonomyDto.locale);
    return data;
  }

  @Get('/categorieswithkeywords')
  @ApiOperation({ summary: 'Get all categories with keywords' })
  @ApiResponses()
  async getAllCategoriesWithKeywords(@Query() taxonomyDto: BaseTaxonomyDto): Promise<Categories> {
    const data = await this.taxonomyService.getAllCategoriesWithKeywords(taxonomyDto.locale);
    return data;
  }

  @Get('/category')
  @ApiOperation({
    summary: 'Get specific category with keywords by ID or name',
  })
  @ApiResponses()
  async getSpecificCategoryWithKeywordsByIdOrName(
    @Query() categoryDto: CategoryChildrenFlatDto,
  ): Promise<Keyword> {
    const data = await this.taxonomyService.getSpecificCategoryWithKeywordsByIdOrName(
      categoryDto.locale,
      categoryDto.categoryId,
      categoryDto.categoryName,
      categoryDto.includeChildren,
      categoryDto.flat,
    );

    return data;
  }

  @Get('/keyword')
  @ApiOperation({ summary: 'Get specific keyword' })
  @ApiResponses()
  async getSpecificKeyword(@Query() keywordDto: KeywordChildrenFlatDto): Promise<Keyword> {
    const data = await this.taxonomyService.getSpecificKeyword(
      keywordDto.locale,
      keywordDto.categoryId,
      keywordDto.keywordId,
      keywordDto.includeChildren,
      keywordDto.flat,
    );

    return data;
  }

  /* @Get('/:localization/category/:categoryId')
    async getSpecificCategoryWithKeywordsById(
        @Param('localization') localization: string,
        @Param('categoryId', ParseIntPipe) categoryId: number,
        @Query() taxonomyDto: TaxonomyDto): Promise<Keyword> {
        const data = await this.taxonomyService.getSpecificCategoryWithKeywordsById(localization, categoryId, taxonomyDto);
        return data;
    } */
}
