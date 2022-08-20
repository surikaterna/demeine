demeine
=======

[Demeine](https://github.com/surikaterna/demeine) is a library supporting DDDD (Distributed Domain Drive Design).

* [Purpose](#purpose)
* [Installation](#installation)
* [Usage](#usage)
* [Components](#components)
    * [Aggregate](#aggregate)
        * [Aggregate Methods](#aggregate-methods)
          * [clearUncommittedEvents](#clearuncommittedevents)
          * [delete](#delete)
          * [getUncommittedEvents](#getuncommittedevents)
          * [getUncommittedEventsAsync](#getuncommittedeventsasync)
          * [getVersion](#getversion)
    * [Repository](#repository)
        * [Repository Methods](#repository-methods)
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



#### Aggregate Methods



##### clearUncommittedEvents



##### delete



##### getUncommittedEvents



##### getUncommittedEventsAsync



##### getVersion



### Repository

You will need to provide a Partition to the Repository.

#### Repository Methods

##### checkConcurrencyStrategy



##### findById



##### findByQueryStreamWithSnapshot



##### findBySnapshot



##### findEventsById



##### save


