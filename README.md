demeine
=======

[Demeine](https://github.com/surikaterna/demeine) is a library supporting DDDD (Distributed Domain Drive Design).

* [Purpose](#purpose)
* [Installation](#installation)
* [Usage](#usage-example)
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



## Components

### Aggregate



#### Aggregate Methods



##### clearUncommittedEvents



##### delete



##### getUncommittedEvents



##### getUncommittedEventsAsync



##### getVersion



### Repository



#### Repository Methods

##### checkConcurrencyStrategy



##### findById



##### findByQueryStreamWithSnapshot



##### findBySnapshot



##### findEventsById



##### save


