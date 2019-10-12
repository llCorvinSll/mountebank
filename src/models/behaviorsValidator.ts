'use strict';

interface ITypeValidationDescriptors {
    [key:string]:ITypeValidationDescriptor;
}

export interface IValidationMap {
    _required?: boolean;
    _allowedTypes?:ITypeValidationDescriptors;
    _additionalContext?: string;
    [key: string]: IValidationMap | IValidationMap[] | boolean | { [key:string]:ITypeValidationDescriptor } | undefined | string;
}

export interface ITypeValidationDescriptor {
    enum?: string[];
    nonNegativeInteger?: boolean;
    positiveInteger?: boolean;
    singleKeyOnly?: boolean;
}

interface IValidator {
    validate(config: IMap, validationSpec: IValidationMap):Error[];
}

interface IMap {
    [key: string]: string | number | IMap;
}

type FiledType = IMap | string | number

type ErrorAppender = (field: IMap | string, message?: string, subConfig?: IValidationMap) => void;

export function create (): IValidator {
    const exceptions = require('../util/errors');

    function hasExactlyOneKey (obj: FiledType) {
        const keys = Object.keys(obj);
        return keys.length === 1;
    }

    function navigate (config: FiledType, path: string): FiledType {
        if (path === '') {
            return config;
        }
        else {
            return path.split('.').reduce(function (field, fieldName) {
                return (field as IMap)[fieldName];
            }, config);
        }
    }

    function typeErrorMessageFor (allowedTypes: string[], additionalContext?: string): string {
        const util = require('util'),
            spellings: IMap = { number: 'a', object: 'an', string: 'a' };
        let message = util.format('must be %s %s', spellings[allowedTypes[0]], allowedTypes[0]);

        for (let i = 1; i < allowedTypes.length; i += 1) {
            message += util.format(' or %s %s', spellings[allowedTypes[i]], allowedTypes[i]);
        }
        if (additionalContext) {
            message += ', representing ' + additionalContext;
        }
        return message;
    }

    function pathFor (pathPrefix: string, fieldName: string): string {
        if (pathPrefix === '') {
            return fieldName;
        }
        else {
            return pathPrefix + '.' + fieldName;
        }
    }

    function nonMetadata (fieldName: string): boolean {
        return fieldName.indexOf('_') !== 0;
    }

    function enumFieldFor (field: FiledType): FiledType {
        const isObject = require('../util/helpers').isObject;

        // Can be the string value or the object key
        if (isObject(field) && Object.keys(field).length > 0) {
            return Object.keys(field)[0];
        }
        else {
            return field;
        }
    }

    function matchesEnum (field: FiledType, enumSpec: string[]) {
        return enumSpec.indexOf(enumFieldFor(field) as string) >= 0;
    }

    function addMissingFieldError (fieldSpec: IValidationMap, path: string, addErrorFn: ErrorAppender) {
        // eslint-disable-next-line no-underscore-dangle
        if (fieldSpec._required) {
            addErrorFn(path, 'required');
        }
    }

    function addArrayErrors (fieldSpec: IValidationMap[], path: string, field: Array<FiledType>, addErrorFn: ErrorAppender) {
        if (!Array.isArray(field)) {
            addErrorFn(path, 'must be an array');
        }
        else {
            field.forEach(function (subConfig: FiledType) {
                // Scope error message to array element instead of entire array
                const newAddErrorFn = function (fieldName: string, message: string) {
                    return addErrorFn(fieldName, message, fieldSpec[0]);
                };
                addErrorsFor(subConfig, '', fieldSpec[0], newAddErrorFn);
            });
        }
    }

    function addTypeErrors (fieldSpec: IValidationMap, path: string, field: FiledType, config: FiledType, addErrorFn: ErrorAppender) {
        /* eslint complexity: 0 */
        const util = require('util'),
            helpers = require('../util/helpers'),
            fieldType: string = typeof field,
            allowedTypes = Object.keys(fieldSpec._allowedTypes as ITypeValidationDescriptors) // eslint-disable-line no-underscore-dangle

        // @ts-ignore
        const typeSpec = fieldSpec._allowedTypes[fieldType]; // eslint-disable-line no-underscore-dangle

        if (!helpers.defined(typeSpec)) {
            addErrorFn(path, typeErrorMessageFor(allowedTypes, fieldSpec._additionalContext)); // eslint-disable-line no-underscore-dangle
        }
        else {
            if (typeSpec.singleKeyOnly && !hasExactlyOneKey(field)) {
                addErrorFn(path, 'must have exactly one key');
            }
            else if (typeSpec.enum && !matchesEnum(field, typeSpec.enum)) {
                addErrorFn(path, util.format('must be one of [%s]', typeSpec.enum.join(', ')));
            }
            else if (typeSpec.nonNegativeInteger && field < 0) {
                addErrorFn(path, 'must be an integer greater than or equal to 0');
            }
            else if (typeSpec.positiveInteger && field <= 0) {
                addErrorFn(path, 'must be an integer greater than 0');
            }

            addErrorsFor(config, path, fieldSpec, addErrorFn);
        }
    }

    function addErrorsFor (config: FiledType, pathPrefix: string, spec: IValidationMap, addErrorFn: ErrorAppender) {
        Object.keys(spec).filter(nonMetadata).forEach(fieldName => {
            const helpers = require('../util/helpers'),
                fieldSpec = spec[fieldName],
                path = pathFor(pathPrefix, fieldName),
                field = navigate(config, path);

            if (!helpers.defined(field)) {
                addMissingFieldError(fieldSpec as IValidationMap, path, addErrorFn);
            }
            else if (Array.isArray(fieldSpec)) {
                addArrayErrors(fieldSpec as IValidationMap[], path, field as any as Array<FiledType>, addErrorFn);
            }
            else {
                addTypeErrors(fieldSpec as any, path, field, config, addErrorFn);
            }
        });
    }

    /**
     * Validates the behavior configuration and returns all errors
     * @param {Object} config - The behavior configuration
     * @param {Object} validationSpec - the specification to validate against
     * @returns {Object} The array of errors
     */
    function validate (config: IMap, validationSpec: IValidationMap): Error[] {
        const errors:Error[] = [];

        Object.keys(config || {}).forEach(key => {
            const util = require('util');
            const addErrorFn: ErrorAppender = function (field: IMap, message: string, subConfig?: IValidationMap): void {
                    errors.push(exceptions.ValidationError(
                        util.format('%s behavior "%s" field %s', key, field, message),
                        { source: subConfig || config }));
                };
            const spec: IValidationMap = {};

            if (validationSpec[key]) {
                spec[key] = validationSpec[key];
                addErrorsFor(config, '', spec, addErrorFn);
            }
        });

        return errors;
    }

    return {
        validate
    };
}
