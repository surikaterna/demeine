import { Event } from '@surikat/core-domain';
import { Location, LocationState } from '../../test/aggregates/Location';
import { ConflictPartition, Partition, SnapshotPartition } from '../../test/partitions';
import { AggregateFactory } from './defaultFactoryCreator';
import { ConcurrencyStrategy, Repository, Snapshot } from './Repository';

describe('Repository', () => {
  const locationFactory: AggregateFactory<Location> = () => new Location();

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

      const partition = new SnapshotPartition(undefined, events);
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
        aggregate.changeName('Hello, World!');
        await repository.save(aggregate);
        const snapshot = await partition.loadSnapshot('1');

        expect(snapshot?.snapshot?.name).toBe('Hello, World!');
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
        await location.registerName('New Name');
        const savedLocation = await repository.save(location);
        expect(savedLocation.getUncommittedEvents().length).toBe(0);
        done();
      } catch (error) {
        done(error);
      }
    });
  });

  describe('conflict strategy', () => {
    it('should throw in conflictStrategy with committedEvents', async (done) => {
      const conflictPartitionEvents: Array<Event<unknown>> = [
        {
          id: 'c2d08471-2e0a-4c27-8557-64201f51f249',
          aggregateId: '1',
          type: 'location.registered_name.event',
          payload: 'New Name committed'
        } as Event<unknown>
      ];
      let conflictStrategyCalled = false;
      const partition = new ConflictPartition<LocationState>(1, conflictPartitionEvents);

      const conflictStrategy: ConcurrencyStrategy = (nextEvents, committedEvents): boolean => {
        expect(nextEvents[0].payload).toBe('New Name');
        expect(committedEvents?.[0].payload).toBe('New Name committed');
        conflictStrategyCalled = true;
        return true; // throw
      };

      const repository = new Repository(partition, 'location', locationFactory, conflictStrategy);

      try {
        const location = await repository.findById('ID_THAT_DO_NOT_EXIST');
        location.registerName('New Name');

        try {
          await repository.save(location);
          done(new Error('should not reach'));
        } catch (error) {
          expect(conflictStrategyCalled).toBe(true);
          done();
        }
      } catch (error) {
        done(error);
      }
    });

    it('should throw in conflictStrategy without committedEvents', async (done) => {
      const conflictPartitionEvents: Array<Event<unknown>> = [
        {
          id: 'c2d08471-2e0a-4c27-8557-64201f51f249',
          aggregateId: '1',
          type: 'location.registered_name.event',
          payload: 'New Name committed'
        } as Event<unknown>
      ];

      let conflictStrategyCalled = false;
      const partition = new ConflictPartition<LocationState>(1, conflictPartitionEvents);

      const conflictStrategy: ConcurrencyStrategy = (nextEvents): boolean => {
        expect(nextEvents[0].payload).toBe('New Name');
        conflictStrategyCalled = true;
        return true; // throw
      };

      const repository = new Repository(partition, 'location', locationFactory, conflictStrategy);

      try {
        const location = await repository.findById('ID_THAT_DO_NOT_EXIST');
        location.registerName('New Name');

        try {
          await repository.save(location);
          done(new Error('should not reach'));
        } catch (error) {
          expect(conflictStrategyCalled).toBe(true);
          done();
        }
      } catch (error) {
        done(error);
      }
    });

    it('should not throw in conflictStrategy', async (done) => {
      const conflictPartitionEvents: Array<Event<unknown>> = [
        {
          id: 'c2d08471-2e0a-4c27-8557-64201f51f249',
          aggregateId: '1',
          type: 'location.registered_name.event',
          payload: 'New Name committed'
        } as Event<unknown>
      ];

      let conflictStrategyCalled = false;
      const partition = new ConflictPartition<LocationState>(1, conflictPartitionEvents);

      const conflictStrategy: ConcurrencyStrategy = (nextEvents): boolean => {
        expect(nextEvents[0].payload).toBe('New Name');
        conflictStrategyCalled = true;
        return false; // do not throw
      };

      const repository = new Repository(partition, 'location', locationFactory, conflictStrategy);

      try {
        const location = await repository.findById('ID_THAT_DO_NOT_EXIST');
        location.registerName('New Name');

        try {
          await repository.save(location);
          done();
        } catch (error) {
          expect(conflictStrategyCalled).toBe(true);
          done(error);
        }
      } catch (error) {
        done(error);
      }
    });
  });

  it('removes and retries snapshot but does not end up in loop if not working', async (done) => {
    const initialSnapshot = ({
      id: '1',
      version: 1,
      snapshot: {
        id: '1',
        no_name: 'hello'
      }
    } as unknown) as Snapshot<LocationState>;
    const events: Array<Event<unknown>> = [
      {
        id: '1',
        aggregateId: '1',
        type: 'location.changed_name.event',
        payload: 'Hello'
      } as Event<unknown>,
      {
        id: '2',
        aggregateId: '1',
        type: 'location.changed_name.event',
        payload: 'Hello, world'
      } as Event<unknown>
    ];

    const partition = new SnapshotPartition(initialSnapshot, events);
    const repository = new Repository(partition, 'location', locationFactory);

    try {
      await repository.findById('1');
      done(new Error('should not fulfill'));
    } catch (error) {
      done();
    }
  });

  it('removes and retries snapshot create when snapshot is broken', async (done) => {
    const initialSnapshot = ({
      id: '1',
      version: 1,
      snapshot: {
        id: '1',
        no_name: 'hello'
      }
    } as unknown) as Snapshot<LocationState>;
    const events: Array<Event<unknown>> = [
      {
        id: '1',
        aggregateId: '1',
        type: 'location.registered_name.event',
        payload: 'Hello'
      } as Event<unknown>,
      {
        id: '1',
        aggregateId: '1',
        type: 'location.changed_name.event',
        payload: 'Hello'
      } as Event<unknown>,
      {
        id: '2',
        aggregateId: '1',
        type: 'location.changed_name.event',
        payload: 'Hello, world'
      } as Event<unknown>
    ];

    const partition = new SnapshotPartition(initialSnapshot, events);
    const repository = new Repository(partition, 'location', locationFactory);

    try {
      const aggregate = await repository.findById('1');
      expect(aggregate.getSnapshot().name).toBe('Hello, world');
      expect(aggregate.getVersion()).toBe(2);

      done();
    } catch (error) {
      done(error);
    }
  });
});
