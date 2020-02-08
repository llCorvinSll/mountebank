

import { IMontebankError } from '../../util/errors';
import * as exceptions from '../../util/errors';
import * as helpers from '../../util/helpers';
import * as util from 'util';
import { IBehaviorsConfig } from './IBehaviorsConfig';
import { IHashMap } from '../../util/types';


export interface IAllowedTypes {
    [key: string]: {
        singleKeyOnly: boolean;
        enum: string[];
        nonNegativeInteger: boolean;
        positiveInteger: boolean;
    };

}

export interface IValidationSpec {
    [key: string]: string | boolean | IAllowedTypes | IValidationSpec|undefined|unknown;

    _required?: boolean;

    _allowedTypes?: IAllowedTypes;

    _additionalContext?: unknown;
}

type AddErrorFn = (field: any, message: string, subConfig?: any) => void;

export class BehaviorsValidator {

    /**
     * Validates the behavior configuration and returns all errors
     * @param {Object} config - The behavior configuration
     * @param {Object} validationSpec - the specification to validate against
     * @returns {Object} The array of errors
     */
    public validate (config: IBehaviorsConfig, validationSpec: IValidationSpec) {
        const errors: IMontebankError[] = [];

        Object.keys(config || {}).forEach(key => {
            const addErrorFn: AddErrorFn = function (field: any, message: string, subConfig: any) {
                errors.push(exceptions.ValidationError(
                    util.format('%s behavior "%s" field %s', key, field, message),
                    { source: subConfig || config }));
            };
            const spec: IValidationSpec = {};

            if (validationSpec[key]) {
                spec[key] = validationSpec[key];
                BehaviorsValidator.addErrorsFor(config, '', spec, addErrorFn);
            }
        });

        return errors;
    }

    private static nonMetadata (fieldName: string) {
        return fieldName.indexOf('_') !== 0;
    }

    private static addMissingFieldError (fieldSpec: IValidationSpec, path: string, addErrorFn: AddErrorFn) {
        //eslint-disable-next-line no-underscore-dangle
        if (fieldSpec._required) {
            addErrorFn(path, 'required');
        }
    }

    private static addArrayErrors (fieldSpec: IValidationSpec[], path: string, field: any, addErrorFn: AddErrorFn) {
        if (!Array.isArray(field)) {
            addErrorFn(path, 'must be an array');
        }
        else {
            field.forEach(function (subConfig) {
                //Scope error message to array element instead of entire array
                const newAddErrorFn = function (fieldName: string, message: string) {
                    return addErrorFn(fieldName, message, subConfig);
                };
                BehaviorsValidator.addErrorsFor(subConfig, '', fieldSpec[0], newAddErrorFn);
            });
        }
    }

    private static hasExactlyOneKey (obj: object): boolean {
        const keys = Object.keys(obj);
        return keys.length === 1;
    }

    private static enumFieldFor (field: object): string {
        //Can be the string value or the object key
        if (helpers.isObject(field) && Object.keys(field).length > 0) {
            return Object.keys(field)[0];
        }
        else {
            return field as unknown as string;
        }
    }

    private static addTypeErrors (fieldSpec: IValidationSpec, path: string, field: object, config: IBehaviorsConfig, addErrorFn: AddErrorFn) {
        /*eslint complexity: 0 */
        const fieldType = typeof field;
        const allowedTypes = Object.keys(fieldSpec._allowedTypes!);
        const typeSpec = fieldSpec._allowedTypes![fieldType];

        if (!helpers.defined(typeSpec)) {
            addErrorFn(path, BehaviorsValidator.typeErrorMessageFor(allowedTypes, fieldSpec._additionalContext));
        }
        else {
            if (typeSpec.singleKeyOnly && !BehaviorsValidator.hasExactlyOneKey(field)) {
                addErrorFn(path, 'must have exactly one key');
            }
            else if (typeSpec.enum && !BehaviorsValidator.matchesEnum(field, typeSpec.enum)) {
                addErrorFn(path, util.format('must be one of [%s]', typeSpec.enum.join(', ')));
            }
            else if (typeSpec.nonNegativeInteger && parseInt(field as any) < 0) {
                addErrorFn(path, 'must be an integer greater than or equal to 0');
            }
            else if (typeSpec.positiveInteger && parseInt(field as any) <= 0) {
                addErrorFn(path, 'must be an integer greater than 0');
            }

            BehaviorsValidator.addErrorsFor(config, path, fieldSpec, addErrorFn);
        }
    }

    private static pathFor (pathPrefix: string, fieldName: string): string {
        if (pathPrefix === '') {
            return fieldName;
        }
        else {
            return pathPrefix + '.' + fieldName;
        }
    }

    private static navigate (config: IBehaviorsConfig, path: string) {
        if (path === '') {
            return config;
        }
        else {
            return path.split('.').reduce(function (field, fieldName) {
                return field[fieldName];
            }, config as any);
        }
    }

    private static matchesEnum (field: any, enumSpec: string[]) {
        return enumSpec.indexOf(BehaviorsValidator.enumFieldFor(field)) >= 0;
    }

    private static typeErrorMessageFor (allowedTypes: string[], additionalContext: unknown) {
        const spellings: IHashMap<string> = { number: 'a', object: 'an', string: 'a' };
        let message = util.format('must be %s %s', spellings[allowedTypes[0]], allowedTypes[0]);

        for (let i = 1; i < allowedTypes.length; i += 1) {
            message += util.format(' or %s %s', spellings[allowedTypes[i]], allowedTypes[i]);
        }
        if (additionalContext) {
            message += ', representing ' + additionalContext;
        }
        return message;
    }

    private static addErrorsFor (config: IBehaviorsConfig, pathPrefix: string, spec: IValidationSpec, addErrorFn: AddErrorFn) {
        Object.keys(spec).filter(BehaviorsValidator.nonMetadata).forEach(fieldName => {
            const fieldSpec = spec[fieldName];
            const path = BehaviorsValidator.pathFor(pathPrefix, fieldName);
            const field = BehaviorsValidator.navigate(config, path);

            if (!helpers.defined(field)) {
                BehaviorsValidator.addMissingFieldError(fieldSpec as IValidationSpec, path, addErrorFn);
            }
            else if (Array.isArray(fieldSpec)) {
                BehaviorsValidator.addArrayErrors(fieldSpec as IValidationSpec[], path, field, addErrorFn);
            }
            else {
                BehaviorsValidator.addTypeErrors(fieldSpec as IValidationSpec, path, field, config, addErrorFn);
            }
        });
    }
}
