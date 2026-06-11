import { Controller, Get, Query, Param, Req, Res, NotFoundException, BadRequestException } from '@nestjs/common';
import { BinaryComponent } from '../interfaces/binary.interface';
import { BinaryComponentUriDto, BinaryComponentDto } from '../dto/binary.dto';
import { BinaryService } from './binary.service';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ApiResponses } from '../../common/swagger/api-responses.decorator';
import { ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';

@Controller()
export class BinaryController {
  constructor(
    private readonly binaryService: BinaryService,
    private readonly configService: ConfigService,
  ) {}

  @Get('api/binarycomponent')
  @ApiOperation({ summary: 'Get binary component source data with cmUri' })
  @ApiResponses()
  async handleBinaryComponent(@Query() binaryDto: BinaryComponentUriDto): Promise<BinaryComponent> {
    const data = await this.binaryService.getBinaryComponentByCmUri(binaryDto.cmUri);
    return data;
  }

  @Get('api/eclcomponent')
  @ApiOperation({ summary: 'Get image url from eclUri' })
  @ApiQuery({
    name: 'eclUri',
    required: true,
    description: 'input ECL uri i.e. --> ecl:0-s3b-Calendar!2F;9月.jpg-S3BucketFile-file',
  })
  @ApiResponses()
  async handleEclComponent(@Query('eclUri') eclUri: string): Promise<string> {
    const data = this.binaryService.getBinaryComponentByEclUri(eclUri);
    return data;
  }

  @Get('api/binary')
  @ApiOperation({
    summary: 'Get binary component source data with locale and binary Id',
  })
  @ApiResponses()
  async handleBinaryComp(@Query() binaryDto: BinaryComponentDto): Promise<BinaryComponent> {
    const data = await this.binaryService.getBinaryComponentById(
      binaryDto.locale,
      binaryDto.binaryId,
    );
    return data;
  }

  @Get(':localization(*)/images/:path(*)')
  @ApiOperation({
    summary: 'Retrieve binary file data based on the localization and path',
  })
  @ApiParam({
    name: 'localization',
    type: String,
    description: 'The locale of the request, representing the language and region.',
    example: 'en-us',
  })
  @ApiParam({
    name: 'path',
    type: String,
    description:
      'The relative path to the binary file after **images** and typically includes the filename with identifiers (e.g., tcm:5-12345).',
    example: 'image_tcm5-12345.jpg',
  })
  @ApiResponses()
  async handleBinary(
    @Param('localization') localization: string,
    @Param('path') path: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const store = this.configService.get<string>('BINARY_CACHE_STORE');
    const requestPath = req.path;
    // const decodedReqPath = decodeURIComponent(req.path);
    // const requestPath = decodedReqPath.includes(path) ? decodedReqPath : path;

    try {
      let result;
  
      if (store === 'redis') {
        result = await this.binaryService.getBinaryComponentByUrl(requestPath);
      } else {
        result = await this.binaryService.getBinaryComponentByUrl2(requestPath);
      }
  
      res.setHeader('Content-Type', result.type);
      return res.send(result.data);
  
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        res.setHeader('Cache-Control', 'public, max-age=300');
  
        return res.status(404).send();
      }
  
      throw error;
    }
  }
}
