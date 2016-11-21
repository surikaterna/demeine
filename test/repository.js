var sdebug = require('slf-debug').default;
require('slf').LoggerFactory.setFactory(sdebug);
require('debug').enable('*');

var should = require('should');
var Promise = require('bluebird');

var Repository = require('..').Repository;

var Location = require('./aggregates/location');


describe('Repository', function() {
	var Partition = function() {
		this.openStream = function(streamId) {
			var Stream = function() {
				this.getCommittedEvents = function(){
					return [];
				};
				this.getVersion = function(){
					return -1;
				}
				this.append = function() {};
				this.commit = function() { return Promise.resolve(null);};
			}
			return Promise.resolve(new Stream(streamId));
		}
	}			
	describe('#findById', function() {

		it('returns aggregate with version = -1 if new stream', function(done) {
			var repo = new Repository(new Partition(), 'test_aggregate');
			repo.findById('ID_THAT_DO_NOT_EXIST').then(function(aggregate) {
				aggregate.getVersion().should.equal(-1);
				done();
			}).catch(function(err) {
				done(err);
			});;		
		});		

		it('creates aggregates with custom factory', function(done) {
			var factory = function() { return new Location();};
			var repo = new Repository(new Partition(), 'location', factory);
			repo.findById('ID_THAT_DO_NOT_EXIST').then(function(aggregate) {
				if(aggregate instanceof Location) {
					done();	
				} else {
					done('Wrong type created');
				}
			}).catch(function(err) {
				done(err);
			});;		
		});
	});
	describe('#save', function() {
		it('save should clear uncommitted events ', function(done) {
			var factory = function() { return new Location();};
			var repo = new Repository(new Partition(), 'location', factory);
			repo.findById('ID_THAT_DO_NOT_EXIST').then(function(location) {
				location.changeName('New Name');
				repo.save(location).then(function(x) {
					x.getUncommittedEvents().length.should.equal(0);
				});
				done();
			}).catch(function(err) {
				done(err);
			});
		});		
	});
});
