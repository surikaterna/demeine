import Aggregate from './Aggregate';
import Event from './Event';

export default interface EventHandler {
  handle(aggregate: Aggregate<any>, event: Event): Promise<any>;
}
