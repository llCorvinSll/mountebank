'use strict';

import * as headersHelper from '../../../src/models/http/headersHelper';

describe('headersHelper', function () {
    describe('#getHeader', function () {
        const request = {
                headers: {
                    'My-First-header': 'first-value',
                    'my-Second-Header': 'second-value'
                }
            },
            getHeader = headersHelper.getHeader;

        it('should search for the header with case-insensity', function () {
            expect(getHeader('my-first-headEr', request.headers)).toEqual('first-value');
            expect(getHeader('my-SECOND-header', request.headers)).toEqual('second-value');
        });

        it('should return undefined if the header is not present', function () {
            expect(getHeader('Missing-Header', request.headers)).toEqual(undefined);
        });
    });

    describe('#setHeader', function () {
        const setHeader = headersHelper.setHeader;

        it('should not change the casing if the header exists', function () {
            const request = {
                headers: {
                    'My-First-header': 'first-value',
                    'my-Second-Header': 'second-value'
                }
            };

            setHeader('my-first-headEr', 'new-value', request.headers);
            expect(
                request.headers).toEqual(
                {
                    'My-First-header': 'new-value',
                    'my-Second-Header': 'second-value'
                }
            );
        });

        it('should keep the casing intact for new headers', function () {
            const request = {
                headers: {
                    'My-First-header': 'first-value',
                    'my-Second-Header': 'second-value'
                }
            };

            setHeader('My-Third-Header', 'third-value', request.headers);
            expect(
                request.headers).toEqual(
                {
                    'My-First-header': 'first-value',
                    'my-Second-Header': 'second-value',
                    'My-Third-Header': 'third-value'
                }
            );
        });
    });

    describe('#getJar', function () {
        describe('#get', function () {
            it('should search for the header with case-insensity', function () {
                const request = {
                        headers: {
                            'My-First-header': 'first-value',
                            'my-Second-Header': 'second-value'
                        }
                    },
                    headersJar = headersHelper.getJar(request.headers);

                expect(headersJar.get('my-first-headEr')).toEqual('first-value');
                expect(headersJar.get('my-SECOND-header')).toEqual('second-value');
            });

            it('should return undefined if the header is not present', function () {
                const request = {
                        headers: {
                            'My-First-header': 'first-value',
                            'my-Second-Header': 'second-value'
                        }
                    },
                    headersJar = headersHelper.getJar(request.headers);

                expect(headersJar.get('Missing-Header')).toEqual(undefined);
            });
        });

        describe('#set', function () {
            it('should not change the casing if the header exists', function () {
                const request = {
                        headers: {
                            'My-First-header': 'first-value',
                            'my-Second-Header': 'second-value'
                        }
                    },
                    headersJar = headersHelper.getJar(request.headers);

                headersJar.set('my-first-headEr', 'new-value');
                expect(request.headers['My-First-header']).toEqual('new-value');
            });

            it('should keep the casing intact for new headers', function () {
                const request = {
                        headers: {
                            'My-First-header': 'first-value',
                            'my-Second-Header': 'second-value'
                        }
                    },
                    headersJar = headersHelper.getJar(request.headers);

                headersJar.set('My-Third-Header', 'third-value');
                // @ts-ignore
                expect(request.headers['My-Third-Header']).toEqual('third-value');
            });
        });
    });
});
