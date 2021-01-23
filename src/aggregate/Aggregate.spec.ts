import { Location } from '../../test/aggregates/Location';
// @ts-ignore
import slfDebug from 'slf-debug';
import { LoggerFactory } from 'slf';

LoggerFactory.setFactory(slfDebug);

describe('Aggregate', () => {
  describe('#_apply', () => {
    it('_apply with new event should add to uncommitted collection', async () => {
      const location = new Location();

      location.registerName('test');
      const events = await location.getUncommittedEventsAsync();

      expect(events.length).toBe(1);
    });
  });

  describe('#_sink (with promise)', () => {
    it('_sink with promise should resolve promise before processing', async () => {
      const location = new Location();

      location.registerName('Initial Name');
      location.changeNameAsync('FIRST-CHANGE');
      location.registerName('SECOND-CHANGE');
      location.changeNameAsync('THIRD-CHANGE');

      expect(() => location.getUncommittedEvents()).toThrow();

      const events = await location.getUncommittedEventsAsync();

      expect(events[0].payload).toBe('Initial Name');
      expect(events[1].payload).toBe('FIRST-CHANGE');
      expect(events[2].payload).toBe('SECOND-CHANGE');
      expect(events[3].payload).toBe('THIRD-CHANGE');
      expect(events.length).toBe(4);
    });
  });

  describe('#<promise> domain function', () => {
    it('should wait for promise', (done) => {
      const location = new Location();
      location.registerName('test').then(() => done());
    });

    it('should return promise error when failure in process', (done) => {
      const location = new Location();

      location
        .failName('test')
        .then(() => done(new Error('Unreachable')))
        .catch(async () => {
          const events = await location.getUncommittedEventsAsync();
          expect(events.length).toBe(0);
          done();
        });
    });

    it('should return promise error when failure in process by throwing', (done) => {
      const location = new Location();

      location
        .failName('fail early')
        .then(() => done(new Error('Unreachable')))
        .catch(async () => {
          const events = await location.getUncommittedEventsAsync();
          expect(events.length).toBe(0);
          done();
        });
    });

    it('should get error', async (done) => {
      const promise = giefPromisePlz();

      try {
        await promise;
        done(new Error('Unreachable'));
      } catch (error) {
        done();
      }
    });
  });
});

function giefPromisePlz() {
  return new Promise((resolve, reject) => {
    try {
      const errorPitcher = () => {
        throw new Error('error is thrown!');
      };

      const allTheSins = errorPitcher();
      resolve(allTheSins);
    } catch (me) {
      reject(me);
    }
  }).catch((up) => {
    throw up;
  });
}
