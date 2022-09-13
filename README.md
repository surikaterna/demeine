demeine
=======

[Demeine](https://github.com/surikaterna/demeine) is a library supporting DDDD (Distributed Domain Drive Design).

* [Purpose](#purpose)
* [Installation](#installation)
* [Usage](#usage)
* [Components](#components)
  * [Aggregate](#aggregate)
    * [clearUncommittedEvents](#clearuncommittedevents)
    * [delete](#delete)
    * [getUncommittedEvents](#getuncommittedevents)
    * [getUncommittedEventsAsync](#getuncommittedeventsasync)
    * [getVersion](#getversion)
  * [Repository](#repository)
    * [checkConcurrencyStrategy](#checkconcurrencystrategy)
    * [findById](#findbyid)
    * [findByQueryStreamWithSnapshot](#findbyquerystreamwithsnapshot)
    * [findBySnapshot](#findbysnapshot)
    * [findEventsById](#findeventsbyid)
    * [save](#save)

## Purpose

Provide the base building blocks for implementing DDD in a distributed environment. This repository contains an
implementation of a _repository_, as well as a base _aggregate_ that domain specific aggregates can extend. The flow of
action → command → event → state update is supported.

## Installation

```shell
npm install demeine
```

## Usage

This example uses [TapeWORM](https://github.com/surikaterna/tapeworm) with its default in memory partition.

```ts
// User.ts
export const USER_AGGREGATE_TYPE = 'user';

export interface UserState {
  id: string;
  name: string;
}

export class User extends Aggregate<UserState> {
  constructor(commandSink?: CommandSink, eventHandler?: EventHandler, commandHandler?: CommandHandler) {
    super(commandSink, eventHandler, commandHandler);

    this._state = {
      id: this.id,
      name: ''
    };
  }

  register(id: string, name: string) {
    this.id = id;

    return this._sink({
      type: 'user.register.command',
      payload: { id, name },
      aggregateId: this.id
    });
  }

  processChangeName(command: Command<UserState>) {
    return this._apply(
      {
        type: 'location.name_changed.event',
        payload: command.payload,
        aggregateId:
        this.id
      },
      true
    );
  }

  applyNameChanged(event: Event<UserState>) {
    this._state.name = event.payload.name;
  }
}

// userFactory.ts
import { User, UserState, USER_AGGREGATE_TYPE } from './User';

export function userFactory(id: string) {
  const user = new User();

  user.id = id;
  user._state = { id, name: '' };
  user.type = USER_AGGREGATE_TYPE;

  return user;
}

// index.ts
import { Aggregate, Repository } from 'demeine';
import TapeWorm from 'tapeworm';
import { User, USER_AGGREGATE_TYPE } from './User';
import { userFactory } from './userFactory';

const tapeWorm = new TapeWorm();
const partition = await tapeWorm.openPartition('my_partition');

const userRepository = new Repository<User>(partition, USER_AGGREGATE_TYPE, userFactory);

// Not found, name: ''
const user = await userRepository.findById('123');
await user.register('123', 'Jeff');
await userRepository.save(user);

// Exists since save(user), name: 'Jeff'
const existingUser = await userRepository.findById('123');
```

## Components

### Aggregate

Base class for aggregate classes representing domain concepts.

#### clearUncommittedEvents

Remove the events created through calling the aggregate methods.

Is used in the [`save`](#save) method on the Repository in order to remove local events after they've been committed.

```typescript
const user = await userRepository.findById('123');

// Adds `user.registered.event` to uncommitted events
await user.register('123', 'Jeff');
// Removes the `registered` event
await user.clearUncommittedEvents();

await userRepository.save(user);
```

#### delete

Creates a `$stream.deleted.event` for the aggregate, which the persistence partition should handle by removing the
aggregate data.

```typescript
const user = await userRepository.findById('123');
await user.delete();
await userRepository.save(user);

// Should not exist anymore
const nonExistingUser = await userRepository.findById('123');
```

#### getUncommittedEvents

Retrieves the list of events created by calling aggregate methods. Prefer to use the async version, as this will
throw if there are unprocessed commands.

```typescript
const user = await userRepository.findById('123');
await user.register('123', 'Jeff');
await user.registerEmail('jeff@21jumpstreet.us');

// [ Event { type: 'user.registered.event' }, Event { type: 'user.email.registered.event' }]
const events = user.getUncommittedEvents();
```

#### getUncommittedEventsAsync

Retrieves the uncommitted events as soon as the processing queue is empty.

```typescript
const user = await userRepository.findById('123');
await user.register('123', 'Jeff');
await user.registerEmail('jeff@21jumpstreet.us');

// [ Event { type: 'user.registered.event' }, Event { type: 'user.email.registered.event' }]
const events = await user.getUncommittedEventsAsync();
```

#### getVersion

Retrieves the version of the aggregate, including increments for the processed uncommitted events.

```typescript
const user = await userRepository.findById('123');
// -1, non existing
const initialVersion = user.getVersion();

await user.register('123', 'Jeff');
await user.registerEmail('jeff@21jumpstreet.us');

// 2, set to 0 for initial + 2 increments for the events
const newVersion = user.getVersion();
```

### Repository

You will need to provide a Partition to the Repository.

#### checkConcurrencyStrategy

Checks the concurrency strategy provided in the Repository constructor. Returns a Promise with a boolean stating whether
it should throw an error or not. Defaults to resolving `false` if no concurrency strategy was provided.

Is used in the [`save`](#save) method on the Repository in order to throw a concurrency error when there's a version
mismatch.

```typescript
const user = await userRepository.findById('123');
const initialVersion = user.getVersion();

await user.register('123', 'Jeff');
await user.registerEmail('jeff@21jumpstreet.us');

// 2, set to 0 for initial + 2 increments for the events
const newVersion = user.getVersion();
```

#### findById

Will look up an Aggregate in the Partition provided to the Repository by the aggregate's ID.

```typescript
const user = await userRepository.findById('123');
```

#### findByQueryStreamWithSnapshot

Will create a rehydrated aggregate by looking up the events for a stream, and processing them. Returns the rehydrated
aggregate.

Requires the persistence partition to implement `queryStreamWithSnapshot`.

```typescript
const user = await userRepository.findById('123');
```

#### findBySnapshot

Will look up a snapshot for the aggregate and  Will create a rehydrated aggregate by looking up the events for a stream, and processing them. Returns the rehydrated
aggregate.

Requires the persistence partition to implement `loadSnapshot` & `queryStream`.

```typescript
const user = await userRepository.findById('123');
```

#### findEventsById

Retrieves the committed (processed) events for the aggregate stream by the aggregate's ID.

```typescript
// [{ type: 'user.registered.event' }. { type: 'user.email.registered.event' }]
const events = await userRepository.findEventsById('123');
```

#### save

Persists the aggregate including executed commands to the persistence partition.

```typescript
// { id: '123', contact: [] }
const user = await userRepository.findById('123');
await user.registerEmail('jeff@21jumpstreet.us');
await userRepository.save(user);

// { id: '123', contact: [{ value: 'jeff@21jumpstreet.us', type: 'email' }] }
const updatedUser = await userRepository.findById('123');
```
