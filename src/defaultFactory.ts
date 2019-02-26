import Aggregate from './Aggregate';

const defaultFactory = function (aggregateType: string) {
	return function () {
		return new Aggregate<object>();
	}
}

export default defaultFactory;