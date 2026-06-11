import { Test, TestingModule } from '@nestjs/testing';
import { BinaryController } from './binary.controller';

describe('BinaryController', () => {
  let controller: BinaryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BinaryController],
    }).compile();

    controller = module.get<BinaryController>(BinaryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
