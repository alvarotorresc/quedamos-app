import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function createMockHost() {
  const mockJson = jest.fn().mockReturnThis();
  const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
  const mockResponse = { status: mockStatus, json: mockJson };

  const host = {
    switchToHttp: jest.fn().mockReturnValue({
      getResponse: jest.fn().mockReturnValue(mockResponse),
    }),
  } as unknown as ArgumentsHost;

  return { host, mockStatus, mockJson };
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
  });

  describe('HttpException', () => {
    it('should return status and body when response is an object', () => {
      const { host, mockStatus, mockJson } = createMockHost();
      const exception = new HttpException(
        { statusCode: 400, message: 'Bad Request' },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, host);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        statusCode: 400,
        message: 'Bad Request',
      });
    });

    it('should wrap string response in standard format', () => {
      const { host, mockStatus, mockJson } = createMockHost();
      const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

      filter.catch(exception, host);

      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalledWith({
        statusCode: 403,
        message: 'Forbidden',
      });
    });

    it('should handle 404 Not Found', () => {
      const { host, mockStatus, mockJson } = createMockHost();
      const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

      filter.catch(exception, host);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({
        statusCode: 404,
        message: 'Not Found',
      });
    });
  });

  describe('Unknown exception', () => {
    it('should return 500 for unknown Error', () => {
      const { host, mockStatus, mockJson } = createMockHost();
      const exception = new Error('Something broke');

      filter.catch(exception, host);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        statusCode: 500,
        message: 'Internal server error',
      });
    });

    it('should return 500 for string exception', () => {
      const { host, mockStatus, mockJson } = createMockHost();

      filter.catch('unexpected string error', host);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        statusCode: 500,
        message: 'Internal server error',
      });
    });

    it('should return 500 for null exception', () => {
      const { host, mockStatus, mockJson } = createMockHost();

      filter.catch(null, host);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        statusCode: 500,
        message: 'Internal server error',
      });
    });
  });
});
