"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../utils");
const isNumber = (type) => type && ['number', 'integer'].includes(type) ? 'number' : type;
const fieldInterfaceBuilder = (type, isArray, items, requiredFields) => `${isArray ? items : isNumber(type)}${utils_1.allOrNothing(isArray, '[]')}`;
exports.interfaceBuilder = (name, fields, requiredFields) => `export interface ${name} {
  ${fields.map(({ name: field, type, format, enum: enumerator, readOnly, items }) => {
    const isArray = type === 'array';
    return `${utils_1.allOrNothing(readOnly, 'readonly ')}${field}${utils_1.allOrNothing(!(requiredFields && requiredFields.includes(field)), '?')}: ${fieldInterfaceBuilder(enumerator ? enumerator.join(' | ') : type, isArray, items, requiredFields)}`;
}).join('\n  ')}
}
`;
function createInterfaces(types) {
    return __awaiter(this, void 0, void 0, function* () {
        const typeInterface = [];
        for (let type of types) {
            typeInterface.push(exports.interfaceBuilder(type.name, type.fields, type.requiredFields));
        }
        return typeInterface;
    });
}
exports.createInterfaces = createInterfaces;
function retrieveEndpointParams({ pathParams, queryParams, bodyParams, includeType = true }) {
    return [
        pathParams && utils_1.allOrNothing(pathParams.length, pathParams.map(param => `${param.name}${utils_1.allOrNothing(includeType, `${utils_1.allOrNothing(!param.required, '?')}: ${isNumber(param.type.type)}`)}`).join(', ')),
        queryParams && utils_1.allOrNothing(queryParams.length, `queryParams${utils_1.allOrNothing(includeType, `: {
    ${utils_1.allOrNothing(queryParams.length, queryParams.map(param => `${param.name}${utils_1.allOrNothing(!param.required, '?')}: ${isNumber(param.type.type)}${utils_1.allOrNothing(param.type.array, '[]')}`).join(',\n    '))}
  }`)}`),
        bodyParams && utils_1.allOrNothing(bodyParams.length, `bodyParams${utils_1.allOrNothing(includeType, `${utils_1.allOrNothing(!(bodyParams.length && bodyParams[0].required), '?')}: ${bodyParams.length && bodyParams[0].type.type}`)}`)
    ].filter(str => str.length).join(', ');
}
function printInterfaceDocumentation(description, actionType, endpointPath) {
    return `/**
  * ${[
        description ? description + '\n  * ' : undefined,
        `${actionType.toUpperCase()} ${endpointPath}`
    ].filter(line => !!line).join('\n  * ')}
  */`;
}
function endpointInterfaceBuilder(endpoints, type) {
    return (`
export interface I${type}Endpoints {${endpoints.map(endpoint => endpoint.actions.map(action => {
        const responseDataType = action.responseDataType ? utils_1.allOrNothing(action.responseDataType.dataType, `Promise<${action.responseDataType.array ? `${action.responseDataType.dataType}[]` : action.responseDataType.dataType} | void>`) : 'void';
        return (`
  ${printInterfaceDocumentation(action.description, action.type, endpoint.path)}
  ${action.name} (${retrieveEndpointParams({ pathParams: action.pathParams, queryParams: action.queryParams, bodyParams: action.bodyParams })}): ${responseDataType}`);
    }).join('\n  ')).join('\n  ')}
}
`.trim());
}
exports.endpointInterfaceBuilder = endpointInterfaceBuilder;
function endpointBuilder(endpoints, type) {
    return (`
export const ${type}Endpoints: I${type}Endpoints = {
  ${endpoints.map(endpoint => endpoint.actions.map(action => {
        const responseDataType = action.responseDataType &&
            utils_1.allOrNothing(action.responseDataType.dataType, `<${action.responseDataType.array ? `${action.responseDataType.dataType}[]` : action.responseDataType.dataType}>`);
        return (`
  ${action.name}: async function (${retrieveEndpointParams({ pathParams: action.pathParams, queryParams: action.queryParams, bodyParams: action.bodyParams, includeType: false })}) {
    try {
      const response = await API.http.${action.type}${utils_1.allOrNothing(responseDataType, responseDataType)}(\`${endpoint.path.replace(/({\w+})/g, (_, param) => `$${param}`)}\`${utils_1.allOrNothing(action.queryParams.length, ', queryParams')}${utils_1.allOrNothing(action.bodyParams.length, ', bodyParams')})

      if (response.ok) {
        return ${responseDataType ? 'response.data' : 'response.ok'}
      } else {
        throw new Error(response.originalError.message)
      }
    } catch (thrown) {
      console.error(thrown)
    }
  }
  `.trim());
    }).join(',\n\n  ')).join(',\n\n  ')}
}
`.trim());
}
exports.endpointBuilder = endpointBuilder;
function filterAllUsedTypes(endpoints) {
    let usedDataTypes = [];
    endpoints.forEach(endpoint => {
        endpoint.actions.forEach(action => {
            if (action.responseDataType && action.responseDataType.dataType)
                usedDataTypes.push(action.responseDataType.dataType);
            action.queryParams.forEach(param => {
                if (param.type)
                    usedDataTypes.push(param.type.type);
            });
            action.pathParams.forEach(param => {
                if (param.type)
                    usedDataTypes.push(param.type.type);
            });
            action.bodyParams.forEach(param => {
                if (param.type)
                    usedDataTypes.push(param.type.type);
            });
        });
    });
    return usedDataTypes;
}
function printUsedTypes(allTypes, usedDataTypes) {
    return allTypes
        .map(type => type.name)
        .filter(typeName => usedDataTypes.includes(typeName));
}
function printClientTag(tag, allTypes) {
    return (`
import { API } from './'

import {
  ${printUsedTypes(allTypes, tag.types)
        .join(',\n  ')}
} from './interfaces.d'

/* INTERFACES */

${tag.interfaces}

/* IMPLEMENTATION */

${tag.endpoints}
`.trim());
}
exports.printClientTag = printClientTag;
function printAPI(tags) {
    return (`
import { create, ApisauceInstance, ApisauceConfig } from 'apisauce'

${tags.map(tag => `import { I${tag.name}Endpoints, ${tag.name}Endpoints } from './${tag.name}'`).join('\n')}

interface SwaggerAPIConfig extends ApisauceConfig {
  baseURL: string
}

const apiConfig: SwaggerAPIConfig = {
  baseURL: undefined // * ADD YOUR API URL HERE
}

interface ISwaggerAPI {
  http: ApisauceInstance
  addAuthTokenToHeaders (authToken: string): void
  removeAuthTokenFromHeaders (): void
  ${tags.map(tag => `${tag.name}: I${tag.name}Endpoints`).join('\n  ')}
}

class SwaggerAPI implements ISwaggerAPI {
  public http: ApisauceInstance

  constructor (config: ApisauceConfig) {
    if (!config.baseURL) throw new Error('You must provide a baseURL to the API client')

    this.http = create(config)
  }

  public addAuthTokenToHeaders (authToken: string) {
    this.http.setHeader('Authorization', \`Bearer \${ authToken }\`)
  }

  public removeAuthTokenFromHeaders () {
    this.http.setHeader('Authorization', '')
  }

  ${tags.map(tag => `public ${tag.name} = ${tag.name}Endpoints`).join('\n\n  ')}
}

export const API = new SwaggerAPI(apiConfig)
`.trim());
}
function createClient(endpointTypes, types) {
    return __awaiter(this, void 0, void 0, function* () {
        let clientTags = [];
        for (let endpointType of endpointTypes) {
            clientTags.push({
                name: endpointType.type,
                interfaces: endpointInterfaceBuilder(endpointType.endpoints, endpointType.type),
                endpoints: endpointBuilder(endpointType.endpoints, endpointType.type),
                types: [...new Set(filterAllUsedTypes(endpointType.endpoints))]
            });
        }
        const client = printAPI(clientTags);
        const tags = clientTags.map(tag => ({
            name: tag.name,
            output: printClientTag(tag, types)
        }));
        return {
            client,
            tags
        };
    });
}
exports.createClient = createClient;
//# sourceMappingURL=builder.js.map