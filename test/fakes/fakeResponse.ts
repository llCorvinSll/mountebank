import { IHashMap } from '../../src/util/types';


export class FakeResponse {
    public headers: IHashMap<string> = {};
    public body: any;
    public statusCode: number;

    public send = (body: any) => {
        this.body = body;
        return this;
    };

    public format = (selectors: any) => {
        selectors.json();
        return this;
    }

    public setHeader (key: string, value: string) {
        this.headers[key] = value;
    }
}

