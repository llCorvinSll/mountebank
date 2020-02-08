import * as Q from 'q';
import * as assert from 'assert';
import { DOMWindow, JSDOM } from 'jsdom';
import { DocsTestScenario, ISubElement } from './docsTestScenario';
import { IHashMap } from '../../../src/util/types';
import stringify = require('json-stable-stringify');
import { ApiClient } from '../../api/api';

const api = new ApiClient();


/**
 * All DOM parsing happens here, including processing the special HTML tags
 */

function getDOM (endpoint: string): Q.Promise<DOMWindow> {
    const deferred = Q.defer<DOMWindow>();
    const url = api.url + endpoint;

    JSDOM.fromURL(url).then(dom => {
        deferred.resolve(dom.window);
    }).catch(errors => {
        deferred.reject(errors);
    });

    return deferred.promise;
}

function asArray (iterable: HTMLCollectionOf<Element>) {
    const result = [];
    for (let i = 0; i < iterable.length; i += 1) {
        result.push(iterable[i]);
    }
    return result;
}

function subElements (parentElement: Element | Document, tagName: string): ISubElement[] {
    return asArray(parentElement.getElementsByTagName(tagName)).map(element => {
        const attributes: IHashMap<string> = {};
        element.getAttributeNames().forEach(attributeName => {
            attributes[attributeName] = element.attributes[attributeName as any].value;
        });

        return {
            subElements: (subTagName: string) => subElements(element, subTagName),
            attributes: attributes,
            attributeValue: (attributeName: string) => attributes[attributeName] || '',
            text: () => element.textContent!.trim(),
            setText: (newText: string) => {
                element.textContent = newText;
            }
        };
    });
}


/*
 * Allows you to show different data than what is actually needed for the test
 * Wrap it in <change to='replacement-value'>display-value</change>
 */
function processChangeCommands (element: ISubElement) {
    const codeElement = element.subElements('code')[0];
    const substitutions = codeElement.subElements('change');
    substitutions.forEach(changeElement => {
        changeElement.setText!(changeElement.attributeValue('to'));
    });
    return codeElement.text!();
}

function normalizeJSON (possibleJSON: string) {
    try {
        return JSON.stringify(JSON.parse(possibleJSON), null, 2);
    }
    catch (e) {
        console.log('WARNING: FAILED NORMALIZING BECAUSE OF INVALID JSON');
        return possibleJSON;
    }
}

/*
 * Allows you to format the JSON however you want in the docs
 * This function ensures whitespace normalization
 */
function normalizeJSONSubstrings (text: string) {
    //[\S\s] because . doesn't match newlines
    const jsonPattern = /\{[\S\s]*\}/;
    if (jsonPattern.test(text)) {
        const prettyPrintedJSON = normalizeJSON(jsonPattern.exec(text)![0]);
        text = text.replace(jsonPattern, prettyPrintedJSON);
    }
    return text;
}

function linesOf (text: string) {
    return text.replace(/\r/g, '').split('\n');
}

function collectVolatileLines (responseElement: ISubElement) {
    const responseLines = linesOf(responseElement.text!());

    return responseElement.subElements('volatile').map(volatileElement => {
        const index = responseLines.findIndex(line => line.indexOf(volatileElement.text!()) >= 0);
        const startOfPattern = `^${responseLines[index].replace(/^\s+/, '\\s+')}`;
        const pattern = `${startOfPattern.replace(volatileElement.text!(), '(.+)')}$`;

        //Another volatile pattern may have the exact same data as this // one
        //(esp. with timestamps). Without removing, we'll miss the second line
        responseLines.splice(index, 1);

        return new RegExp(pattern);
    });
}

/*
 * Allows you to wrap volatile data in <volatile></volatile> tags. It will
 * not be compared. The volatile tags only work if opened and closed on the
 * same line. Comparisons are done by line to make the HTML read better:
 * you can have multiple volatile lines for the same logical pattern
 */
function replaceVolatileData (text: string, volatileLines: RegExp[]) {
    return volatileLines.reduce((accumulator, volatileLinePattern) => {
        const textLines = linesOf(accumulator);
        //Skip ones that have already been replaced
        const lineIndex = textLines.findIndex(line => !/696969696969696969/.test(line) && volatileLinePattern.test(line));
        if (lineIndex >= 0) {
            const matches = volatileLinePattern.exec(textLines[lineIndex]);
            textLines[lineIndex] = textLines[lineIndex].replace(matches![1], '696969696969696969');
        }
        return textLines.join('\n');
    }, text);
}

function stabilizeJSON (possibleJSON: string) {
    try {
        return stringify(JSON.parse(possibleJSON), { space: '  ' });
    }
    catch (e) {
        console.log('WARNING: FAILED STABILIZING BECAUSE OF INVALID JSON');
        return possibleJSON;
    }
}

function stabilizeJSONSubstrings (text: string) {
    //[\S\s] because . doesn't match newlines
    const jsonPattern = /\{[\S\s]*\}/;
    if (jsonPattern.test(text)) {
        const prettyPrintedJSON = stabilizeJSON(jsonPattern.exec(text)![0]);
        text = text.replace(jsonPattern, prettyPrintedJSON);
    }
    return text;
}

function normalize (text: string, responseElement: ISubElement) {
    const trimmed = (text || '').trim();
    const normalizedJSON = normalizeJSONSubstrings(trimmed);
    const volatileLines = collectVolatileLines(responseElement);
    const sanitizedValue = replaceVolatileData(normalizedJSON, volatileLines);

    return stabilizeJSONSubstrings(sanitizedValue);
}

function isPartialComparison (responseElement: ISubElement) {
    return responseElement.attributeValue('partial') === 'true';
}


interface IDifference {
    index: number;
    missingLine: string;
    previous: string;
    next: string;
}

function setDifference (partialExpectedLines: string[], actualLines: string[]) {
    const difference: IDifference[] = [];
    let lastIndex = -1;

    //Track index in closure to ensure two equivalent lines in partialExpected don't match
    //the same line in actual. The lines have to match in order.
    partialExpectedLines.forEach((expectedLine, index) => {
        const matchedIndex = actualLines.findIndex((actualLine, matchIndex) =>
            //Allow comma at end because the actual JSON could include additional elements we don't care about
            matchIndex > lastIndex &&
                (expectedLine.trim() === actualLine.trim() || `${expectedLine.trim()},` === actualLine.trim()));
        if (matchedIndex < 0) {
            difference.push({
                index: index,
                missingLine: expectedLine,
                previous: partialExpectedLines.slice(Math.max(0, index - 10), index).join('\n'),
                next: partialExpectedLines.slice(index + 1, Math.min(partialExpectedLines.length - 1, index + 5)).join('\n')
            } as IDifference);
        }
        else {
            lastIndex = matchedIndex;
        }
    });

    return difference;
}

/*
 * Each request is wrapped in a <step type='http'></step> tag
 * The step can accept other attributes needed for other types (e.g. filename)
 * If you want to validate the response for the request, add a
 * <assertResponse</assertResponse> tag around the response text
 */
function createStepSpecFrom (stepElement: ISubElement): ISubElement {
    const stepSpec = stepElement.attributes as ISubElement;
    const responseElements = stepElement.subElements('assertResponse');

    stepSpec.requestText = processChangeCommands(stepElement);
    stepSpec.assertValid = () => {};

    if (responseElements.length > 0) {
        const responseElement = responseElements[0];
        const expectedResponse = processChangeCommands(responseElement);

        stepSpec.assertValid = (actualResponse: string, failureMessage: string) => {
            const actual = normalize(actualResponse, responseElement);
            const expected = normalize(expectedResponse, responseElement);

            if (isPartialComparison(responseElement)) {
                assert.deepEqual(setDifference(linesOf(expected), linesOf(actual)), [], failureMessage);
            }
            else {
                assert.strictEqual(actual, expected, failureMessage);
            }
        };
    }
    return stepSpec;
}

function createScenarioFrom (testElement: ISubElement, endpoint: string): DocsTestScenario {
    const scenarioName = testElement.attributeValue('name');
    const scenario = new DocsTestScenario(endpoint, scenarioName);

    testElement.subElements('step').forEach(stepElement => {
        scenario.addStep(createStepSpecFrom(stepElement));
    });

    return scenario;
}

/*
 * Each scenario is wrapped in a <testScenario name='scenario-name></testScenario> tag
 */
export function getScenarios (endpoint: string) {
    const deferred = Q.defer<IHashMap<DocsTestScenario>>();

    getDOM(endpoint).done(window => {
        const testElements = subElements(window.document, 'testScenario');
        const testScenarios: IHashMap<DocsTestScenario> = {};

        testElements.forEach(testElement => {
            const scenarioName = testElement.attributeValue('name');
            testScenarios[scenarioName] = createScenarioFrom(testElement, endpoint);
        });
        deferred.resolve(testScenarios);
    });

    return deferred.promise;
}
