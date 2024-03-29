import { Location, RegisterNamePayload } from '../aggregate/__fixtures__/Location';
import { Repository } from '../repository';
import { BasicPartition } from './__fixtures__/BasicPartition';
import { ConflictPartition } from './__fixtures__/ConflictPartition';
import { SnapshotPartition } from './__fixtures__/SnapshotPartition';
import { ConcurrencyStrategy } from './Repository.interfaces';

describe('Repository', () => {
  const factory = () => new Location();

  describe('#findById', () => {
    it('returns aggregate with version = -1 if new stream', async () => {
      const repository = new Repository(new BasicPartition(), 'test_aggregate', undefined, undefined, { resetSnapshotOnFail: false });
      const aggregate = await repository.findById('ID_THAT_DO_NOT_EXIST');
      expect(aggregate.getVersion()).toBe(-1);
    });

    it('creates aggregates with custom factory', async () => {
      const repository = new Repository(new BasicPartition(), 'location', factory);

      const aggregate = await repository.findById('ID_THAT_DO_NOT_EXIST');
      expect(aggregate).toBeInstanceOf(Location);
    });

    it('hydrates aggregates with snapshot', async () => {
      const repository = new Repository<Location>(
        new SnapshotPartition({ id: '1', version: 1, snapshot: { name: 'hello' } }, [{
          id: '1',
          type: 'location.registered_name.event',
          payload: { name: 'Hello' }
        }]),
        'location',
        factory
      );

      const aggregate = await repository.findById('1');
      expect(aggregate).toBeInstanceOf(Location);
      expect(aggregate._getSnapshot()?.name).toBe('hello');
      expect(aggregate.getVersion()).toBe(1);
    });

    it('hydrates aggregates with snapshot and events', async () => {
      const repository = new Repository<Location>(
        new SnapshotPartition({ id: '1', version: 1, snapshot: { name: 'hello' } }, [
          { id: '1', aggregateId: '1', type: 'location.registered_name.event', payload: { name: 'Hello' } },
          { id: '2', aggregateId: '1', type: 'location.changed_name.event', payload: { name: 'Hello, world' } }
        ]),
        'location',
        factory
      );

      const aggregate = await repository.findById('1');
      expect(aggregate).toBeInstanceOf(Location);
      expect(aggregate._getSnapshot()?.name).toBe('Hello, world');
      expect(aggregate.getVersion()).toBe(2);
    });

    it('hydrates aggregates without snapshot', async () => {
      const repository = new Repository<Location>(
        new SnapshotPartition(undefined, [{
          id: '1',
          aggregateId: '1',
          type: 'location.registered_name.event',
          payload: { name: 'Hello' }
        }]),
        'location',
        factory
      );
      const aggregate = await repository.findById('1');
      expect(aggregate).toBeInstanceOf(Location);
      expect(aggregate._getSnapshot()?.name).toBe('Hello');
    });

    it('stores snapshot for aggregate on save', async () => {
      const partition = new SnapshotPartition<Location>({ id: '1', version: 1, snapshot: { name: 'hello' } }, [
        { id: '1', type: 'location.registered_name.event', payload: { name: 'Hello' } }
      ]);
      const repository = new Repository<Location>(partition, 'location', factory);

      const aggregate = await repository.findById('1');
      aggregate.changeName('Hello, World!');
      await repository.save(aggregate);

      const snapshot = await partition.loadSnapshot('1');
      expect(snapshot?.snapshot?.name).toBe('Hello, World!');
    });
  });

  it('should allow delete', async () => {
    const repository = new Repository<Location>(new BasicPartition<Location>(), 'location', factory);
    const location = await repository.findById('ID_THAT_DO_NOT_EXIST');

    location.registerName('New Name');
    await repository.save(location);
    location.delete();
    return repository.save(location);
  });

  describe('#save', () => {
    it('save should clear uncommitted events ', async () => {
      const repository = new Repository<Location>(new BasicPartition(), 'location', factory);
      const location = await repository.findById('ID_THAT_DO_NOT_EXIST');
      location.registerName('New Name');

      const savedLocation = await repository.save(location);
      expect(savedLocation.getUncommittedEvents()).toHaveLength(0);
    });
  });
  describe('conflict strategy', () => {
    it('should throw in conflictStrategy with committedEvents', async () => {
      let conflictStrategyCalled = false;
      const partition = new ConflictPartition<Location, RegisterNamePayload>();

      const conflictStrategy: ConcurrencyStrategy<RegisterNamePayload> = (nextEvents, committedEvents) => {
        expect(nextEvents[0].payload.name).toBe('New Name');
        expect(committedEvents?.[0].payload.name).toBe('New Name committed');
        conflictStrategyCalled = true;
        return true; // throw..
      };

      const repository = new Repository<Location, RegisterNamePayload>(partition, 'location', factory, conflictStrategy);
      const location = await repository.findById('ID_THAT_DO_NOT_EXIST');
      location.registerName('New Name');

      await expect(repository.save(location)).rejects.toThrow();
      expect(conflictStrategyCalled).toBe(true);
    });

    it('should throw in conflictStrategy without committedEvents', async () => {
      let conflictStrategyCalled = false;
      const partition = new ConflictPartition<Location, RegisterNamePayload>();

      const conflictStrategy: ConcurrencyStrategy<RegisterNamePayload> = (nextEvents) => {
        expect(nextEvents[0].payload.name).toBe('New Name');
        conflictStrategyCalled = true;
        return true; // throw..
      };

      const repository = new Repository(partition, 'location', factory, conflictStrategy);
      const location = await repository.findById('ID_THAT_DO_NOT_EXIST');
      location.registerName('New Name');
      await expect(repository.save(location)).rejects.toThrow();
      expect(conflictStrategyCalled).toBe(true);
    });

    it('should not throw in conflictStrategy', async () => {
      let conflictStrategyCalled = false;
      const partition = new ConflictPartition<Location, RegisterNamePayload>();

      const conflictStrategy: ConcurrencyStrategy<RegisterNamePayload> = (nextEvents) => {
        expect(nextEvents[0].payload.name).toBe('New Name');
        conflictStrategyCalled = true;
        return false; // do not throw..
      };

      const repository = new Repository(partition, 'location', factory, conflictStrategy);
      const location = await repository.findById('ID_THAT_DO_NOT_EXIST');
      location.registerName('New Name');
      await repository.save(location);
    });
  });

  it('removes and retries snapshot but does not end up in loop if not working', () => {
    const repository = new Repository(
      new SnapshotPartition({ id: '1', version: 1, snapshot: { no_name: 'hello' } }, [
        { id: '1', aggregateId: '1', type: 'location.changed_name.event', payload: { name: 'Hello' } },
        { id: '2', aggregateId: '1', type: 'location.changed_name.event', payload: { name: 'Hello, world' } }
      ]),
      'location',
      factory
    );

    expect(repository.findById('1')).rejects.toThrow();
  });

  it('removes and retries snapshot create when snapshot is broken', async () => {
    const repository = new Repository<Location>(
      new SnapshotPartition({ id: '1', version: 1, snapshot: { no_name: 'hello' } }, [
        { id: '1', aggregateId: '1', type: 'location.registered_name.event', payload: { name: 'Hello' } },
        { id: '1', aggregateId: '1', type: 'location.changed_name.event', payload: { name: 'Hello' } },
        { id: '2', aggregateId: '1', type: 'location.changed_name.event', payload: { name: 'Hello, world' } }
      ]),
      'location',
      factory
    );
    const location = await repository.findById('1');

    expect(location).toBeInstanceOf(Location);
    expect(location._getSnapshot()?.name).toBe('Hello, world');
    expect(location.getVersion()).toBe(2);
  });
});
