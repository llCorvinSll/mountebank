'use strict';

import * as Q from 'q';
import * as  util from 'util';
import {HashMap} from "../../../src/util/types";

interface IStep {
    actualResponse?: any;
    assertValid?: (actualResponse: any, message: string) => void;
    execute: () => Q.Promise<boolean>;
}

export interface ISubElement {
    subElements(name: string): ISubElement[];
    attributeValue(name: string): string;
    attributes: HashMap<string>;
    requestText?:string;
    assertValid?: (actualResponse: any, message: string) => void;
    setText?: (text: string) => void;
    text?: () => string;
    type?: string;
    [key: string]: string | Function | HashMap<string> | undefined;
}

export class DocsTestScenario {
    constructor(private endpoint: string, private id: string) {
    }

    public addStep(stepSpec: ISubElement): void {
        const step: IStep = {
            assertValid: stepSpec.assertValid,
            execute: () => {
                const runner = require(`./testTypes/${stepSpec.type}`);

                return runner.runStep(stepSpec).then((actualResponse: any) => {
                    step.actualResponse = actualResponse;
                    return Q(true);
                });
            }
        };

        this.steps.push(step);
    }

    public assertValid () {
        const stepExecutions = this.steps.map(step => step.execute);
        const chainedExecutions: Q.Promise<boolean> = stepExecutions.reduce<Q.Promise<any>>(Q.when, Q());

        return chainedExecutions.then(() => {
            this.steps.forEach((step, stepIndex) => {
                const failureMessage = util.format(
                        '%s %s step %s failed; below is the actual result\n' +
                        '-----------\n' +
                        '%s\n' +
                        '-----------', this.endpoint, this.id, stepIndex + 1, step.actualResponse);

                step.assertValid!(step.actualResponse, failureMessage);
            });
        });
    }

    private steps: IStep[] = [];
}
