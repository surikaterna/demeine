import Aggregate from './Aggregate';

class DefaultAggregate extends Aggregate<object> {
	_state: object = {}
}

const defaultFactory = function (aggregateType: string) {
	return function () {
		return new DefaultAggregate();
	}
}

export default defaultFactory;