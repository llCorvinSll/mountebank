'use strict';

export function sanitizeBody (response:any) {
    const body = JSON.stringify(response.body);
    const withTimeRemoved = body.replace(/"timestamp":"[^"]+"/g, '"timestamp":"NOW"');
    const withClientPortRemoved = withTimeRemoved
        .replace(/"requestFrom":"[a-f:.\d]+"/g, '"requestFrom":"HERE"')
        .replace(/"Date":"[^"]+"/g, '"Date":"NOW"')
        .replace(/"_uuid":"[\S]+?"/g, '"_uuid":"696969696969"');
    const sanitizedBody = JSON.parse(withClientPortRemoved);
    return sanitizedBody;
}
