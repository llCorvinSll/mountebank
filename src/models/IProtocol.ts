'use strict';

import {IImposter, IImposterConfig} from "./IImposter";
import {IMontebankError} from "../util/errors";
import * as Q from "q";

export interface IProtocol {
    testRequest():void;
    testProxyResponse():void;
    validate(imposter_config:IImposterConfig):Q.Promise<IValidation>;
    createImposterFrom(imposter_config:IImposterConfig):Q.Promise<IImposter>;
}


export interface IValidation {
    isValid: boolean;
    errors: IMontebankError[];
}
