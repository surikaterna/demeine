export interface Disposable {
  dispose(): void;
}

interface MessageSubscription extends Disposable {

}

export default interface MessageSubscriber {
  subscribe(messageType: string): MessageSubscription;
}