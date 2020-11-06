import SagaRegistry from '../src/saga/SagaRegistry';

describe('Sagas', function () {
  describe('registry', function () {
    it('should be able to create a new SagaRegistry', function () {
      const registry = new SagaRegistry();
      expect(registry).toBeTruthy();
    });
  });
});
