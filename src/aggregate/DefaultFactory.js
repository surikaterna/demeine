import { Aggregate } from './Aggregate';

export function DefaultFactory(aggregateType) {
	return function() {
		return new Aggregate();
	}
}
