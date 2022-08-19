import Promise from 'bluebird';
import { Aggregate } from '../../aggregate';
import { Event } from '../../aggregate/Aggregate.interfaces';
import { Partition, Stream } from '../Partition';
import { BasicStream } from './BasicStream';

export class BasicPartition<T extends Aggregate = Aggregate> implements Partition<T> {
  openStream(id: string, isWriteOnly?: boolean): Promise<Stream> {
    return Promise.resolve(new BasicStream());
  }

  delete(id: string, event: Event<object>): Promise<T> {
    return Promise.resolve(new Aggregate() as T);
  }
}
