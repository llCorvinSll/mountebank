'use strict';

/**
 * Validating a syntactically correct imposter creation statically is quite difficult.
 * This module validates dynamically by running test requests through each predicate and each stub
 * to see if it throws an error.  A valid request is one that passes the dry run error-free.
 * @module
 */

import {ILogger} from "../util/scopedLogger";
import {IResponse} from "./IRequest";
import {IMontebankError, InjectionError, ValidationError} from "../util/errors";
import * as Q from "q";
import {IStubRepository, StubRepository} from "./stubs/stubRepository";
import {IImposterConfig} from "./IImposter";
import {IServerRequestData, IValidation} from "./IProtocol";
import {ResponseResolver} from "./responseResolver";
import {IStubConfig} from "./stubs/IStubConfig";


interface IDryRunValidatorOptions {
    allowInjection:boolean;
    testRequest:IServerRequestData;
    testProxyResponse:any;
    additionalValidation:(cfg:IImposterConfig) => Q.Promise<IValidation>
}

/**
 * Creates the validator
 * @param {Object} options - Configuration for the validator
 * @param {Object} options.testRequest - The protocol-specific request used for each dry run
 * @param {Object} options.testProxyResponse - The protocol-specific fake response from a proxy call
 * @param {boolean} options.allowInjection - Whether JavaScript injection is allowed or not
 * @param {function} options.additionalValidation - A function that performs protocol-specific validation
 * @returns {Object}
 */
export function create (options: IDryRunValidatorOptions) {
    function stubForResponse (originalStub: IStubConfig, response: IResponse, withPredicates: boolean) {
        // Each dry run only validates the first response, so we
        // explode the number of stubs to dry run each response separately
        const helpers = require('../util/helpers'),
            clonedStub = helpers.clone(originalStub),
            clonedResponse = helpers.clone(response);
        clonedStub.responses = [clonedResponse];

        // If the predicates don't match the test request, we won't dry run
        // the response (although the predicates will be dry run).  We remove
        // the predicates to account for this scenario.
        if (!withPredicates) {
            delete clonedStub.predicates;
        }

        return clonedStub;
    }

    function reposToTestFor (stub: IStubConfig, encoding: string) {
        // Test with predicates (likely won't match) to make sure predicates don't blow up
        // Test without predicates (always matches) to make sure response doesn't blow up
        const stubsToValidateWithPredicates = stub.responses ? stub.responses.map(response => stubForResponse(stub, response, true)) : [],
            stubsToValidateWithoutPredicates = stub.responses ? stub.responses.map(response => stubForResponse(stub, response, false)) : [],
            stubsToValidate = stubsToValidateWithPredicates.concat(stubsToValidateWithoutPredicates);

        return stubsToValidate.map(stubToValidate => {
            const stubRepository: IStubRepository = new StubRepository(encoding);
            stubRepository.addStub(stubToValidate);
            return stubRepository;
        });
    }

    function resolverFor (stubRepository: IStubRepository) {

        // We can get a better test (running behaviors on proxied result) if the protocol gives
        // us a testProxyResult
        if (options.testProxyResponse) {
            const dryRunProxy = { to: () => Q(options.testProxyResponse) };
            return new ResponseResolver(stubRepository, dryRunProxy);
        }
        else {
            return new ResponseResolver(stubRepository, undefined, 'URL');
        }
    }

    function dryRun (stub: IStubConfig, encoding: string, logger: ILogger) {
        const combinators = require('../util/combinators'),
            dryRunLogger: ILogger = {
                debug: combinators.noop,
                info: combinators.noop,
                warn: combinators.noop,
                error: logger.error
            } as any as ILogger,
            dryRunRepositories = reposToTestFor(stub, encoding);

        options.testRequest = options.testRequest || {};
        options.testRequest.isDryRun = true;
        return Q.all(dryRunRepositories.map(stubRepository => {
            // @ts-ignore
            const responseConfig = stubRepository.getResponseFor(options.testRequest, dryRunLogger, {}),
                resolver = resolverFor(stubRepository);
            return resolver.resolve(responseConfig, options.testRequest, dryRunLogger, {});
        }));
    }

    function addDryRunErrors (stub: IStubConfig, encoding: string, errors: IMontebankError[], logger: ILogger) {
        const deferred = Q.defer();

        try {
            dryRun(stub, encoding, logger).done(deferred.resolve, reason => {
                reason.source = reason.source || JSON.stringify(stub);
                errors.push(reason);
                deferred.resolve();
            });
        }
        catch (error) {
            errors.push(ValidationError('malformed stub request', {
                data: error.message,
                source: error.source || stub
            }));
            deferred.resolve();
        }

        return deferred.promise;
    }

    function hasPredicateGeneratorInjection (response: IResponse) {
        return response.proxy && response.proxy.predicateGenerators &&
            response.proxy.predicateGenerators.some(generator => generator.inject);
    }

    function hasStubInjection (stub: IStubConfig) {
        const hasResponseInjections = stub.responses && stub.responses.some((response: IResponse) => {
                const hasDecorator = response._behaviors && response._behaviors.decorate,
                    hasWaitFunction = response._behaviors && typeof response._behaviors.wait === 'string';

                return response.inject || hasDecorator || hasWaitFunction || hasPredicateGeneratorInjection(response);
            }),
            hasPredicateInjections = Object.keys(stub.predicates || {}).some(predicate => stub.predicates && stub.predicates[predicate].inject),
            hasAddDecorateBehaviorInProxy = stub.responses && stub.responses.some(response => response.proxy && response.proxy.addDecorateBehavior);
        return hasResponseInjections || hasPredicateInjections || hasAddDecorateBehaviorInProxy;
    }

    function hasShellExecution (stub: IStubConfig) {
        return stub.responses && stub.responses.some(response => response._behaviors && response._behaviors.shellTransform);
    }

    function addStubInjectionErrors (stub: IStubConfig, errors: IMontebankError[]) {
        if (options.allowInjection) {
            return;
        }

        if (hasStubInjection(stub)) {
            errors.push(InjectionError(
                'JavaScript injection is not allowed unless mb is run with the --allowInjection flag', { source: stub }));
        }
        if (hasShellExecution(stub)) {
            errors.push(InjectionError(
                'Shell execution is not allowed unless mb is run with the --allowInjection flag', { source: stub }));
        }
    }

    function addAllTo (values: any[], additionalValues: any[]) {
        additionalValues.forEach(value => {
            values.push(value);
        });
    }

    function addBehaviorErrors (stub: IStubConfig, errors: IMontebankError[]) {
        stub.responses && stub.responses.forEach(response => {
            const behaviors = require('./behaviors');
            addAllTo(errors, behaviors.validate(response._behaviors));
        });
    }

    function errorsForStub (stub: IStubConfig, encoding: string, logger: ILogger) {
        const errors: IMontebankError[] = [],
            deferred = Q.defer();

        if (!Array.isArray(stub.responses) || stub.responses.length === 0) {
            errors.push(ValidationError("'responses' must be a non-empty array", {
                source: stub
            }));
        }
        else {
            addStubInjectionErrors(stub, errors);
            addBehaviorErrors(stub, errors);
        }

        if (errors.length > 0) {
            // no sense in dry-running if there are already problems;
            // it will just add noise to the errors
            deferred.resolve(errors);
        }
        else {
            addDryRunErrors(stub, encoding, errors, logger).done(() => {
                deferred.resolve(errors);
            });
        }

        return deferred.promise;
    }

    function errorsForRequest (request: IImposterConfig) {
        const errors = [],
            hasRequestInjection = request.endOfRequestResolver && request.endOfRequestResolver.inject;

        if (!options.allowInjection && hasRequestInjection) {
            // @ts-ignore
            errors.push(InjectionError(
                'JavaScript injection is not allowed unless mb is run with the --allowInjection flag',
                { source: request.endOfRequestResolver }));
        }
        return errors;
    }

    /**
     * Validates that the imposter creation is syntactically valid
     * @memberOf module:models/dryRunValidator#
     * @param {Object} request - The request containing the imposter definition
     * @param {Object} logger - The logger
     * @returns {Object} Promise resolving to an object containing isValid and an errors array
     */
    function validate (request: IImposterConfig, logger: ILogger):Q.Promise<IValidation> {
        const stubs = request.stubs || [],
            encoding = request.mode === 'binary' ? 'base64' : 'utf8',
            validationPromises = stubs.map(stub => errorsForStub(stub, encoding, logger)),
            deferred = Q.defer<IValidation>();

        validationPromises.push(Q(errorsForRequest(request)));
        if (typeof options.additionalValidation === 'function') {
            validationPromises.push(Q(options.additionalValidation(request)));
        }

        Q.all(validationPromises).done((errorsForAllStubs: IMontebankError[]) => {
            const allErrors = errorsForAllStubs.reduce((accumulator, stubErrors) => accumulator.concat(stubErrors), [] as IMontebankError[]);
            deferred.resolve({ isValid: allErrors.length === 0, errors: allErrors });
        });

        return deferred.promise;
    }

    return { validate };
}
