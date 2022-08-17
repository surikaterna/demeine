import { LoggerFactory } from 'slf';
import sdebug from 'slf-debug';
import { Location } from './__fixtures__/Location';

LoggerFactory.setFactory(sdebug);

describe('Aggregate', () => {
  describe('#_apply', () => {
    it('_apply with new event should add to uncommitted collection', async () => {
      const location = new Location();
      location.registerName('test');
      const events = await location.getUncommittedEventsAsync();
      expect(events).toHaveLength(1);
    });
  });

  describe('#_sink (with promise)', () => {
    it('_sink with promise should resolve promise before processing', async () => {
      const location = new Location();
      location.registerName('Initial Name');
      location.changeNameAsync('FIRST-CHANGE');
      location.registerName('SECOND-CHANGE');
      location.changeNameAsync('THIRD-CHANGE');

      expect(() => {
        // Should throw if trying to get uncommitted events while still processing
        location.getUncommittedEvents();
      }).toThrow();

      const events = await location.getUncommittedEventsAsync();
      expect(events[0].payload).toBe('Initial Name');
      expect(events[1].payload).toBe('FIRST-CHANGE');
      expect(events[2].payload).toBe('SECOND-CHANGE');
      expect(events[3].payload).toBe('THIRD-CHANGE');
      expect(events).toHaveLength(4);
    });
  });

  describe('#<promise> domain function', () => {
    it('should wait for promise', (done) => {
      const location = new Location();
      location.registerName('test').then(() => {
        done();
      });
    });

    it('should return promise error when failure in process', async () => {
      const location = new Location();
      await expect(location.failName('test')).rejects.toThrow();

      const events = await location.getUncommittedEventsAsync();
      expect(events).toHaveLength(0);
    });

    it('should return promise error when failure in process by throwing', async () => {
      const location = new Location();
      expect(location.failName('fail early')).rejects.toThrow('Failing early');

      const events = await location.getUncommittedEventsAsync();
      expect(events).toHaveLength(0);
    });
  });
});
