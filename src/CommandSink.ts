import Aggregate, { Command } from './Aggregate';
export default interface CommandSink {
  sink(command: Command, aggregate?: Aggregate<any>): any;
}
