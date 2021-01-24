import { Event } from '@surikat/core-domain';
import { Location, LocationState } from '../../test/aggregates/Location';
import { Partition, SnapshotPartition } from '../../test/partitions';
import { Repository, Snapshot } from './Repository';

describe('Repository', () => {
  const locationFactory: () => Location = () => new Location();

  describe('#findById', () => {
    it('returns aggregate with version = -1 if new stream', async (done) => {
      const repository = new Repository(new Partition(), 'test_aggregate', undefined, undefined, { resetSnapshotOnFail: false });

      try {
        const aggregate = await repository.findById('ID_THAT_DO_NOT_EXIST');
        expect(aggregate.getVersion()).toBe(-1);
        done();
      } catch (error) {
        done(error);
      }
    });

    it('creates aggregates with custom factory', async (done) => {
      const repository = new Repository(new Partition(), 'location', locationFactory);

      try {
        const aggregate = await repository.findById('ID_THAT_DO_NOT_EXIST');

        if (aggregate instanceof Location) {
          done();
        } else {
          done('Wrong type created');
        }
      } catch (error) {
        done(error);
      }
    });

    it('hydrates aggregates with snapshot', async (done) => {
      const snapshot: Snapshot<LocationState> = {
        id: '1',
        version: 1,
        snapshot: {
          id: '1',
          name: 'hello'
        }
      };
      const events: Array<Event<unknown>> = [
        {
          id: '1',
          type: 'location.registered_name.event',
          payload: 'Hello'
        } as Event<unknown>
      ];

      const partition = new SnapshotPartition(snapshot, events);
      const repository = new Repository(partition, 'location', locationFactory);

      try {
        const aggregate = await repository.findById('1');

        if (aggregate instanceof Location) {
          expect(aggregate.getSnapshot().name).toBe('hello');
          expect(aggregate.getVersion()).toBe(1);
          done();
        } else {
          done('Wrong type created');
        }
      } catch (error) {
        done(error);
      }
    });

    it('hydrates aggregates with snapshot and events', async (done) => {
      const snapshot: Snapshot<LocationState> = {
        id: '1',
        version: 1,
        snapshot: {
          id: '1',
          name: 'hello'
        }
      };
      const events: Array<Event<unknown>> = [
        {
          id: '1',
          aggregateId: '1',
          type: 'location.registered_name.event',
          payload: 'Hello'
        } as Event<unknown>,
        {
          id: '2',
          aggregateId: '1',
          type: 'location.changed_name.event',
          payload: 'Hello, world'
        } as Event<unknown>
      ];

      const partition = new SnapshotPartition(snapshot, events);
      const repository = new Repository(partition, 'location', locationFactory);

      try {
        const aggregate = await repository.findById('1');

        if (aggregate instanceof Location) {
          expect(aggregate.getSnapshot().name).toBe('Hello, world');
          expect(aggregate.getVersion()).toBe(2);
          done();
        } else {
          done('Wrong type created');
        }
      } catch (error) {
        done(error);
      }
    });

    it('hydrates aggregates without snapshot', async (done) => {
      const events: Array<Event<unknown>> = [
        {
          id: '1',
          aggregateId: '1',
          type: 'location.registered_name.event',
          payload: 'Hello'
        } as Event<unknown>
      ];

      // TODO: Fix issue with incompatible states, or unnecessary since it's just test data?
      const partition = new SnapshotPartition(
        undefined as unknown as Snapshot<LocationState>,
        events
      );
      const repository = new Repository(partition, 'location', locationFactory);

      try {
        const aggregate = await repository.findById('1');

        if (aggregate instanceof Location) {
          expect(aggregate.getSnapshot().name).toBe('Hello');
          done();
        } else {
          done('Wrong type created');
        }
      } catch (error) {
        done(error);
      }
    });

    it('stores snapshot for aggregate on save', async (done) => {
      const initialSnapshot: Snapshot<LocationState> = {
        id: '1',
        version: 1,
        snapshot: {
          id: '1',
          name: 'hello'
        }
      };
      const events: Array<Event<unknown>> = [
        {
          id: '1',
          type: 'location.registered_name.event',
          payload: 'Hello'
        } as Event<unknown>
      ];

      const partition = new SnapshotPartition(initialSnapshot, events);
      const repository = new Repository(partition, 'location', locationFactory);

      try {
        const aggregate = await repository.findById('1');
        // TODO: Fix repository to return proper aggregate instead of aggregate with <State>
        // Should not need to cast
        (aggregate as Location).changeName('Hello, World!')
        await repository.save(aggregate);
        const snapshot = await partition.loadSnapshot('1')

        expect(snapshot?.snapshot?.name).toBe('Hello, World!')
        done();
      } catch (error) {
        done(error);
      }
    });
  });

  describe('#save', () => {
    it('save should clear uncommitted events', async (done) => {
      const repository = new Repository(new Partition(), 'location', locationFactory);

      try {
        const location = await repository.findById('ID_THAT_DO_NOT_EXIST');
        // TODO: Fix in Repository
        await (location as Location).registerName('New Name')
        const savedLocation = await repository.save(location);
        expect(savedLocation.getUncommittedEvents().length).toBe(0);
        done();
      } catch (error) {
        done(error);
      }

    });
  });

  describe('conflict strategy', () => {
    it.todo('save should clear uncommitted events');
    it.todo('should throw in conflictStrategy without committedEvents');
    it.todo('should not throw in conflictStrategy');
  });

  it.todo('removes and retries snapshot but does not end up in loop if not working');
  it.todo('removes and retries snapshot create when snapshot is broken');
});
