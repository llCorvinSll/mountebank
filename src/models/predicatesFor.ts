import { IMountebankResponse, IServerRequestData } from './IProtocol';
import { IMatch, IPredicateGenerator, IRequest, IResponse } from './IRequest';
import { ILogger } from '../util/scopedLogger';
import { IJsonPathConfig, IPredicate, IXPathConfig } from './predicates/IPredicate';
import * as errors from '../util/errors';
import * as helpers from '../util/helpers';
import * as xpath from './xpath';
import * as jsonpath from './jsonpath';
import { IProxyConfig } from './stubs/IStubConfig';
import { IBehaviorsConfig } from './behaviors/IBehaviorsConfig';


function xpathValue (xpathConfig: IXPathConfig, possibleXML: string, logger: ILogger) {
    const nodes = xpath.select(xpathConfig.selector, xpathConfig.ns!, possibleXML, logger);
    return selectionValue(nodes);
}


function jsonpathValue (jsonpathConfig: IJsonPathConfig, possibleJSON: string, logger: ILogger) {
    const nodes = jsonpath.select(jsonpathConfig.selector, possibleJSON, logger);
    return selectionValue(nodes);
}


function selectionValue (nodes: any) {
    if (!helpers.defined(nodes)) {
        return '';
    }
    else if (!Array.isArray(nodes)) {
        return nodes; // booleans and counts
    }
    else {
        return (nodes.length === 1) ? nodes[0] : nodes;
    }
}

export function newIsResponse (this: void, response: IMountebankResponse, proxyConfig: IProxyConfig): IResponse {
    const result: IResponse = { is: response };
    const addBehaviors: IBehaviorsConfig = {} as any;

    if (proxyConfig.addWaitBehavior && response._proxyResponseTime) {
        addBehaviors.wait = response._proxyResponseTime;
    }
    if (proxyConfig.addDecorateBehavior) {
        addBehaviors.decorate = proxyConfig.addDecorateBehavior;
    }

    if (Object.keys(addBehaviors).length) {
        result._behaviors = addBehaviors;
    }
    return result;
}


function buildEquals (request: IRequest, matchers: Readonly<IMatch>, valueOf: any) {
    const result: any = {};

    Object.keys(matchers).forEach(key => {
        if (helpers.isObject(request[key])) {
            result[key] = buildEquals(request![key] as any, matchers[key], valueOf);
        }
        else {
            result[key] = valueOf(request[key]);
        }
    });
    return result;
}

function buildExists (this: void, request: IRequest | undefined, fieldName: string, matchers: Readonly<IMatch>, initialRequest: any, pathes: string[]): any {
    request = request || {} as IRequest;

    Object.keys(request || {}).forEach(key => {
        pathes.push(key);
        if (helpers.isObject(request![key])) {
            buildExists(request![key] as any, fieldName, matchers[key], initialRequest, pathes);
        }
        else {
            const booleanValue = (typeof fieldName !== 'undefined' && fieldName !== null && fieldName !== '');
            helpers.setDeep(initialRequest, pathes, booleanValue);
        }
    });
    return initialRequest;
}

export function predicatesFor (this: void, request: IServerRequestData, matchers: IPredicateGenerator[], pathes: string[], logger: ILogger) {
    const predicates: IPredicate[] = [];

    matchers.forEach((matcher: Readonly<IPredicateGenerator>) => {
        if (matcher.inject) {
            // eslint-disable-next-line no-unused-vars,@typescript-eslint/ban-ts-ignore
            // @ts-ignore
            const config = { request, logger };
            const injected = `(${matcher.inject})(config);`;
            try {
                predicates.push(...eval(injected));
            }
            catch (error) {
                logger.error(`injection X=> ${error}`);
                logger.error(`    source: ${JSON.stringify(injected)}`);
                logger.error(`    request: ${JSON.stringify(request)}`);
                throw errors.InjectionError('invalid predicateGenerator injection', { source: injected, data: error.message });
            }
            return;
        }

        const basePredicate: IPredicate = {} as any;
        let hasPredicateOperator = false;
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore
        let predicateOperator; // eslint-disable-line no-unused-vars
        let valueOf = (field: any) => field;

        // Add parameters
        Object.keys(matcher).forEach(key => {
            if (key !== 'matches' && key !== 'predicateOperator') {
                basePredicate[key] = matcher[key];
            }
            if (key === 'xpath') {
                valueOf = field => xpathValue(matcher.xpath!, field, logger);
            }
            else if (key === 'jsonpath') {
                valueOf = field => jsonpathValue(matcher.jsonpath!, field, logger);
            }
            else if (key === 'predicateOperator') {
                hasPredicateOperator = true;
                predicateOperator = matcher[key];
            }
        });

        Object.keys(matcher.matches!).forEach(fieldName => {
            const matcherValue = matcher.matches![fieldName];
            const predicate = helpers.clone(basePredicate);
            if (matcherValue === true && !hasPredicateOperator) {
                predicate.deepEquals = {};
                (predicate.deepEquals as any)[fieldName] = valueOf(request[fieldName]);
            }
            else if (hasPredicateOperator && matcher.predicateOperator === 'exists') {
                predicate[matcher.predicateOperator] = buildExists(request as any, fieldName, matcherValue, request, pathes);
            }
            else if (hasPredicateOperator && matcher.predicateOperator !== 'exists') {
                predicate[matcher.predicateOperator!] = valueOf(request);
            }
            else {
                predicate.equals = {};
                (predicate.equals as any)[fieldName] = buildEquals((request as any)[fieldName], matcherValue, valueOf);
            }

            predicates.push(predicate);
        });
    });

    return predicates;
}
