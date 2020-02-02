import {IStub} from "./IStub";
import {IStubConfig} from "./IStubConfig";
import {IMountebankResponse, IServerRequestData} from "../IProtocol";
import {ILogger} from "../../util/scopedLogger";

export interface IStubRepository {
    stubs:() => IStub[];

    addStub(stub:IStubConfig, beforeResponse?:IMountebankResponse):void;

    addStubAtIndex(index:string, newStub:IStubConfig):void;

    overwriteStubs(newStubs:IStubConfig[]):void;

    overwriteStubAtIndex(index:string, newStub:IStubConfig):void;

    deleteStubAtIndex(index:string):void;

    getResponseFor(request:IServerRequestData, logger:ILogger, imposterState:unknown):IMountebankResponse;

    resetProxies():void;

    stubIndexFor(responseConfig:IMountebankResponse):number;

    indexOfStubToAddResponseTo(responseConfig:IMountebankResponse, request:IServerRequestData, pathes: string[], logger:ILogger):number;

    addNewResponse(responseConfig:IMountebankResponse, request:IServerRequestData, response:IMountebankResponse, pathes: string[], logger:ILogger):void;
}
