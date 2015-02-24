var Location = require('./aggregates/location');
describe('Aggregate', function() {
	describe('#_apply', function() {
		it('_apply with new event should add to uncommitted collection', function() {
			var loc = new Location();
			loc.changeName('test');
			loc.getUncommittedEvents().length.should.equal(1);
		});		
	});
});
