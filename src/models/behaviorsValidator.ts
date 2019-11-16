'use strict';

import {IMontebankError} from "../util/errors";
import * as exceptions from '../util/errors';
import * as helpers from '../util/helpers';
import * as util from 'util';



export class BehaviorsValidator {

    /**
     * Validates the behavior configuration and returns all errors
     * @param {Object} config - The behavior configuration
     * @param {Object} validationSpec - the specification to validate against
     * @returns {Object} The array of errors
     */
    public validate (config, validationSpec) {
        const errors:IMontebankError[] = [];

        Object.keys(config || {}).forEach(key => {
            const addErrorFn = function (field, message, subConfig) {
                    errors.push(exceptions.ValidationError(
                        util.format('%s behavior "%s" field %s', key, field, message),
                        { source: subConfig || config }));
                },
                spec = {};

            if (validationSpec[key]) {
                spec[key] = validationSpec[key];
                BehaviorsValidator.addErrorsFor(config, '', spec, addErrorFn);
            }
        });

        return errors;
    }

    private static nonMetadata (fieldName) {
        return fieldName.indexOf('_') !== 0;
    }

    private static addMissingFieldError (fieldSpec, path, addErrorFn) {
        // eslint-disable-next-line no-underscore-dangle
        if (fieldSpec._required) {
            addErrorFn(path, 'required');
        }
    }

    private static addArrayErrors (fieldSpec, path, field, addErrorFn) {
        if (!Array.isArray(field)) {
            addErrorFn(path, 'must be an array');
        }
        else {
            field.forEach(function (subConfig) {
                // Scope error message to array element instead of entire array
                const newAddErrorFn = function (fieldName, message) {
                    return addErrorFn(fieldName, message, subConfig);
                };
                BehaviorsValidator.addErrorsFor(subConfig, '', fieldSpec[0], newAddErrorFn);
            });
        }
    }

    private static hasExactlyOneKey (obj) {
        const keys = Object.keys(obj);
        return keys.length === 1;
    }

    private static enumFieldFor (field) {
        // Can be the string value or the object key
        if (helpers.isObject(field) && Object.keys(field).length > 0) {
            return Object.keys(field)[0];
        }
        else {
            return field;
        }
    }

    private static addTypeErrors (fieldSpec, path, field, config, addErrorFn) {
        /* eslint complexity: 0 */
        const fieldType = typeof field,
            allowedTypes = Object.keys(fieldSpec._allowedTypes), // eslint-disable-line no-underscore-dangle
            typeSpec = fieldSpec._allowedTypes[fieldType]; // eslint-disable-line no-underscore-dangle

        if (!helpers.defined(typeSpec)) {
            addErrorFn(path, BehaviorsValidator.typeErrorMessageFor(allowedTypes, fieldSpec._additionalContext)); // eslint-disable-line no-underscore-dangle
        }
        else {
            if (typeSpec.singleKeyOnly && !BehaviorsValidator.hasExactlyOneKey(field)) {
                addErrorFn(path, 'must have exactly one key');
            }
            else if (typeSpec.enum && !BehaviorsValidator.matchesEnum(field, typeSpec.enum)) {
                addErrorFn(path, util.format('must be one of [%s]', typeSpec.enum.join(', ')));
            }
            else if (typeSpec.nonNegativeInteger && field < 0) {
                addErrorFn(path, 'must be an integer greater than or equal to 0');
            }
            else if (typeSpec.positiveInteger && field <= 0) {
                addErrorFn(path, 'must be an integer greater than 0');
            }

            BehaviorsValidator.addErrorsFor(config, path, fieldSpec, addErrorFn);
        }
    }

    private static pathFor (pathPrefix, fieldName) {
        if (pathPrefix === '') {
            return fieldName;
        }
        else {
            return pathPrefix + '.' + fieldName;
        }
    }

    private static navigate (config, path) {
        if (path === '') {
            return config;
        }
        else {
            return path.split('.').reduce(function (field, fieldName) {
                return field[fieldName];
            }, config);
        }
    }

    private static matchesEnum (field, enumSpec) {
        return enumSpec.indexOf(BehaviorsValidator.enumFieldFor(field)) >= 0;
    }

    private static typeErrorMessageFor (allowedTypes, additionalContext) {
        const spellings = { number: 'a', object: 'an', string: 'a' };
        let message = util.format('must be %s %s', spellings[allowedTypes[0]], allowedTypes[0]);

        for (let i = 1; i < allowedTypes.length; i += 1) {
            message += util.format(' or %s %s', spellings[allowedTypes[i]], allowedTypes[i]);
        }
        if (additionalContext) {
            message += ', representing ' + additionalContext;
        }
        return message;
    }

    private static addErrorsFor (config, pathPrefix, spec, addErrorFn) {
        Object.keys(spec).filter(BehaviorsValidator.nonMetadata).forEach(fieldName => {
            const fieldSpec = spec[fieldName],
                path = BehaviorsValidator.pathFor(pathPrefix, fieldName),
                field = BehaviorsValidator.navigate(config, path);

            if (!helpers.defined(field)) {
                BehaviorsValidator.addMissingFieldError(fieldSpec, path, addErrorFn);
            }
            else if (Array.isArray(fieldSpec)) {
                BehaviorsValidator.addArrayErrors(fieldSpec, path, field, addErrorFn);
            }
            else {
                BehaviorsValidator.addTypeErrors(fieldSpec, path, field, config, addErrorFn);
            }
        });
    }
}
