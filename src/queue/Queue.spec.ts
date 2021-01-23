import { Queue } from './Queue';

describe('Queue', () => {
  it('Processes queue in order', async (done) => {
    const queue = new Queue();
    let string = '';

    const incrementString = (i: number) => () => string += i;

    for (let i = 0; i < 10; i++) {
      queue.queueCommand(incrementString(i));
    }

    try {
      await queue.queueCommand(() => {
        string = string + '10';
      });

      expect(string).toBe('012345678910');
      done();
    } catch (error) {
      console.log(error);
    }
  });

  it('should return promise that is resolved upon running complete', async () => {
    const queue = new Queue();
    let toChange = 12;

    const change = () => {
      toChange = 10;
    };

    await queue.queueCommand(change);
    expect(toChange).toBe(10);
  });

  it('should return promise that is resolved directly when not running', (done) => {
    const queue = new Queue();
    queue.empty().then(() => done());
  });
});
