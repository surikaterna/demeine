import { Disposable } from './MessageSubscriber';
/** call dispose to ack the message and "let it go" */
export default interface Message extends Disposable {
  id: string;
  type: string;
  headers: {
    key: string;
    value: string;
  }[];
  content: any;
}
