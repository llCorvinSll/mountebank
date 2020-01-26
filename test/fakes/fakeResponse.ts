import {HashMap} from "../../src/util/types";
import {Response} from 'express';

export class FakeResponse implements Response {
    public headers:HashMap<string> = {};
    public body:any;
    public statusCode:number;

    // @ts-ignore
    send = (body:any) => {
        this.body = body;
        return this;
    };

    // @ts-ignore
    public format = (selectors:any) => {
        selectors.json();
        return this;
    }

    setHeader(key:string, value:string) {
        this.headers[key] = value;
    };
}

