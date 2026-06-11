import { Test, TestingModule } from '@nestjs/testing';
import { BinaryService } from './binary.service';

describe('BinaryService', () => {
  let service: BinaryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BinaryService],
    }).compile();

    service = module.get<BinaryService>(BinaryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
