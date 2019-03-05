import Aggregate from './Aggregate';

interface Command {
  type: string;
}

export default interface CommandHandler {
  handle(aggregate: Aggregate<any>, command: Command): Promise<any>;
}
