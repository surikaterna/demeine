import { Commit, Partition as RepositoryPartition } from '../../src/aggregate';
import Stream from './Stream';

export class Partition implements RepositoryPartition {
  public openStream(streamId: string, _writeOnly?: boolean): Promise<Stream> {
    return Promise.resolve(new Stream(streamId));
  }

  public queryStream<Events = unknown>(_id: string, _version?: number): Promise<Array<Commit<Events>>> {
    return Promise.resolve([]);
  }
}

export default Partition;
