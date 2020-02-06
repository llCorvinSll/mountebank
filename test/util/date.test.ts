

import * as date from '../../src/util/date';

describe('date', function () {
    describe('#when', function () {
        it('should be today if date is the same', function () {
            expect(date.howLongAgo('2015-01-09', '2015-01-09')).toEqual('today');
        });

        it('should be yesterday for 1 day ago of same month', function () {
            expect(date.howLongAgo('2015-01-09', '2015-01-10')).toEqual('yesterday');
        });

        it('should be yesterday for last day of previous month if today is the first day of next month', function () {
            expect(date.howLongAgo('2015-01-31', '2015-02-01')).toEqual('yesterday');
        });

        it('should be yesterday for last day of previous year if today is first day of year', function () {
            expect(date.howLongAgo('2014-12-31', '2015-01-01')).toEqual('yesterday');
        });

        it('should be this week for two days ago', function () {
            expect(date.howLongAgo('2015-01-08', '2015-01-10')).toEqual('this week');
        });

        it('should be this week for six days ago', function () {
            expect(date.howLongAgo('2015-01-04', '2015-01-10')).toEqual('this week');
        });

        it('should be last week for seven days ago', function () {
            expect(date.howLongAgo('2015-01-03', '2015-01-10')).toEqual('last week');
        });

        it('should be last week for 13 days ago', function () {
            expect(date.howLongAgo('2014-12-28', '2015-01-10')).toEqual('last week');
        });

        it('should be this month for 14 days ago in same month', function () {
            expect(date.howLongAgo('2015-01-17', '2015-01-31')).toEqual('this month');
        });

        it('should be this month for 30 days ago in same month', function () {
            //Adding time to avoid UTC conversion pushing it back a month
            expect(date.howLongAgo('2015-01-01T18:00:00.000Z', '2015-01-31')).toEqual('this month');
        });

        it('should be empty fo 14 days ago last month', function () {
            expect(date.howLongAgo('2014-12-31', '2015-01-14')).toEqual('');
        });
    });
});
