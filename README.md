# demeine
DDDD - Distributed Domain Drive Design

## Aggregate
An Aggregate is a write-model container for business logic

## Sagas
Saga is a long-running business process coordination which is persisted. Aim is to allow for a fault tolerant way of managing processes in an event based application.

```typescript

interface MySagaState {
  orderId : number
}

@Saga(name='My Saga')
class MySaga extends Saga<MySagaState> {
 /**
  * @StartedBy registers an event message handler that kicks off a new saga instance when that message arrives
  */
  @StartedBy(MyEvent)
  handleMyEvent(event:MyEvent): Task {
    setState({orderId: event.orderId});
  }

  /**
   * Alterntively write the name of the event instead of using class name
   */
  @HandleEvent('order.cancelled.event')
  handleCancellation(event:OrderCancellationEvent) {
    return new PublishTask();
  }
}

```