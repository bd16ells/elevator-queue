
// Copyright 2018-2020Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const ddb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION });

const { TABLE_NAME } = process.env;

exports.handler = async event => {
    var body = event.Records[0].body;
    // save to DB
    const putParams = {
        TableName: process.env.TABLE_NAME,
        Item: {
            PK: uuidv4(),
            SK: 'queue',
            content: body
        }
    };
    try {
        ddb.put(putParams).promise();
    } catch (err) {
        return { statusCode: 500, body: 'Failed to save: ' + JSON.stringify(err) };
    }

    let connectionData;

    try {
        const queryParams = {
            TableName: TABLE_NAME,
            IndexName: 'GSI1',
            KeyConditionExpression: "#ff = :sk",
            ExpressionAttributeValues: {
                ":sk": "cxn"
            },
            ExpressionAttributeNames: {
                "#ff": "SK"
            }
        }
        connectionData = await ddb.query(queryParams).promise();
    } catch (e) {
        return { statusCode: 500, body: e.stack };
    }

    const apigwManagementApi = new AWS.ApiGatewayManagementApi({
        apiVersion: '2018-11-29',
        endpoint: 'https://x58rk6xp0e.execute-api.us-east-1.amazonaws.com/Prod'
    });

    const postCalls = connectionData.Items.map(async ({ PK }) => {
        console.log(PK)
        try {
            await apigwManagementApi.postToConnection({ ConnectionId: PK, Data: body }).promise();
        } catch (e) {
            console.log("ERROR*********")
            console.log(e)
            if (e.statusCode === 410) {
                const deleteParams = {
                    TableName: process.env.TABLE_NAME,
                    Key: {
                        PK: PK,
                        SK: 'cxn'
                    }
                };
                console.log(`Found stale connection, deleting ${PK}`);
                await ddb.delete(deleteParams).promise();
            } else {
                throw e;
            }
        }
    });

    try {
        await Promise.all(postCalls);
    } catch (e) {
        return { statusCode: 500, body: e.stack };
    }

    return { statusCode: 200, body: 'Data sent.' };
};
