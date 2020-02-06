

import { IServer } from '../IProtocol';

const config = JSON.parse(process.argv[2]);
const httpServer = require('./httpServer');
const mbConnection = require('../mbConnection').create(config);

httpServer.create(config, mbConnection.logger(), mbConnection.getResponse).done((server: IServer) => {
    mbConnection.setPort(server.port);
    mbConnection.setProxy(require('./httpProxy').create(mbConnection.logger()));

    const metadata = server.metadata;
    metadata.port = server.port;
    console.log(JSON.stringify(metadata));
}, (error: any) => {
    console.error(JSON.stringify(error));
    process.exit(1);
});
