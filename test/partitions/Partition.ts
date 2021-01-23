export class Partition {
  openStream = (streamId: string) => {
    class Stream {
      constructor(_streamId: string) {
      }

      append = (): void => {
      };
      commit = (): Promise<null> => Promise.resolve(null);
      getCommittedEvents = (): Array<unknown> => [];
      getVersion = (): number => -1;
    }

    return Promise.resolve(new Stream(streamId));
  };
}

export default Partition;
