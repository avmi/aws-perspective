const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient();
const configService = new AWS.ConfigService();
const R = require('ramda');
const dynoexpr = require('@tuplo/dynoexpr');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const all = ps => Promise.all(ps);

const query = R.curry((docClient, TableName, query) => docClient.query({TableName, ...query}).promise());
const update = docClient => params => docClient.update(params).promise();

const batchWrite = R.curry((docClient, retryDelay, writes) => {
    function batchWrite_(writes, attempt) {
        return docClient.batchWrite(writes).promise()
            .then(async ({UnprocessedItems}) => {
                if (attempt > 3 || R.isEmpty(UnprocessedItems)) return {UnprocessedItems};
                await sleep(attempt * retryDelay);
                return batchWrite_({RequestItems: UnprocessedItems}, attempt + 1);
            })
    }

    return batchWrite_(writes, 0);
});

const createAccountQuery = TableName => accountId => ({
    TableName,
    KeyConditionExpression: 'PK = :PK and begins_with(SK, :SK)',
    ExpressionAttributeValues: {
        ':PK': 'Account',
        ':SK': `ACCNUMBER#${accountId}`
    }
});

const createDeleteRequest = ({PK, SK}) => ({DeleteRequest: {Key: {PK, SK}}});

const createPutRequest = (query) => ({PutRequest: {Item: query}});

const createBatchWriteRequest = TableName => writes => ({RequestItems: {[TableName]: writes}});

const getAccountId = ({DeleteRequest: {Key: {SK}}}) => SK.match(/ACCNUMBER#(?<accountId>\d*)#/).groups.accountId;

const getUnprocessedItems = TableName => R.pathOr([], ['UnprocessedItems', TableName]);

function createAccountNoQuery(TableName) {
    return {
        TableName,
        KeyConditionExpression: 'PK = :PK',
        ExpressionAttributeValues: {
            ':PK': 'AccountNumber'
        }
    }
}

const DUPLICATE_ACCOUNTS_ERROR = 'Your configuration aggregator contains duplicate accounts. Delete the duplicate accounts and try again.'

function deleteAccounts(docClient, configService, TableName, {configAggregator, accountIds}) {
    return Promise.resolve(createAccountNoQuery(TableName))
        .then(query(docClient, TableName))
        .then(R.prop('Items'))
        .then(R.map(R.prop('accountId')))
        .then(R.without(accountIds))
        .then(async AccountIds => {
            return  configService.putConfigurationAggregator({
                ConfigurationAggregatorName: configAggregator,
                AccountAggregationSources: [
                    {
                        AccountIds,
                        AllAwsRegions: true
                    },
                ]
            }).promise();
        })
        .catch(err => {
            if (err.message === DUPLICATE_ACCOUNTS_ERROR) {
                console.log(err);
            } else {
                throw err;
            }
        })
        .then(() => accountIds)
        .then(R.map(createAccountQuery(TableName)))
        .then(R.map(query(docClient, TableName)))
        .then(all)
        .then(R.chain(R.prop('Items')))
        .then(R.concat(R.map(accountId => ({PK: 'AccountNumber', SK: accountId}), accountIds)))
        .then(R.chain(createDeleteRequest))
        .then(R.splitEvery(25))
        .then(R.map(createBatchWriteRequest(TableName)))
        .then(R.map(batchWrite(docClient, 1000)))
        .then(all)
        .then(R.chain(getUnprocessedItems(TableName)))
        .then(R.map(getAccountId))
        .then(R.uniq)
        .then(unprocessedAccounts => ({unprocessedAccounts}))
}

function updateAccount(docClient, TableName, {accountId, ...Update}) {
    return docClient.update(dynoexpr({
            TableName,
            Key: {
                PK: 'Account',
                SK: `ACCNUMBER#${accountId}#METADATA`
            },
            Update
        }
    )).promise()
        .then(() => ({accountId, ...Update}))
}

function updateRegions(docClient, TableName, {accountId, regions}) {
    return Promise.resolve(regions)
        .then(R.map(({name, ...Update}) => (dynoexpr({
                    TableName,
                    Key: {
                        PK: 'Account',
                        SK: `ACCNUMBER#${accountId}#REGION#${name}`
                    },
                    Update
                }
            )
        )))
        .then(R.map(update(docClient)))
        .then(all)
        .then(() => ({accountId, regions}))
}

function getAccounts(docClient, TableName) {
    return Promise.resolve({
        KeyConditionExpression: 'PK = :PK',
        ExpressionAttributeValues: {
            ':PK': 'Account'
        }
    })
        .then(query(docClient, TableName))
        .then(R.prop('Items'))
        .then(R.groupBy(R.prop('accountId')))
        .then(R.map(account => R.reduce((memo, item) => {
            if (item.type === 'account') {
                memo.accountId = item.accountId;
                memo.lastCrawled = item.lastCrawled;
            } else if (item.type === 'region') {
                const {lastCrawled, name} = item;
                memo.regions.push({
                    lastCrawled,
                    name
                });
            }
            return memo;
        }, {regions: []}, account)))
        .then(R.values)
}

function createAccountNoPutQuery(TableName, accountId) {
    return {
        PK: 'AccountNumber',
        SK: accountId,
        accountId
    }
}

function createAccountPutQuery(TableName, accountId) {
    return {
        PK: 'Account',
        SK: `ACCNUMBER#${accountId}#METADATA`,
        accountId: accountId,
        type: 'account'
    }
}

const createRegionPutQuery = R.curry((TableName, accountId, region) => {
    return {
        PK: 'Account',
        SK: `ACCNUMBER#${accountId}#REGION#${region.name}`,
        name: region.name,
        accountId: accountId,
        type: 'region'
    }
});

function addAccounts(docClient, configService, TableName, {accounts, configAggregator}) {
    return Promise.resolve(createAccountNoQuery(TableName))
        .then(query(docClient, TableName))
        .then(R.prop('Items'))
        .then(R.concat(accounts))
        .then(R.map(R.prop('accountId')))
        .then(async AccountIds => {
            return configService.putConfigurationAggregator({
                ConfigurationAggregatorName: configAggregator,
                AccountAggregationSources: [
                    {
                        AccountIds,
                        AllAwsRegions: true
                    },
                ]
            }).promise();
        })
        .catch(err => {
            if (err.message === DUPLICATE_ACCOUNTS_ERROR) {
                console.log(err);
            } else {
                throw err;
            }
        })
        .then(() => accounts)
        .then(R.chain(({accountId, regions}) => {
            return [
                createAccountNoPutQuery(TableName, accountId),
                createAccountPutQuery(TableName, accountId),
                ...R.map(createRegionPutQuery(TableName, accountId), regions)
            ]
        }))
        .then(R.map(createPutRequest))
        .then(R.splitEvery(25))
        .then(R.map(createBatchWriteRequest(TableName)))
        .then(R.map(batchWrite(docClient, 1000)))
        .then(all)
        .then(getUnprocessedItems(TableName))
        .then(R.map(getAccountId))
        .then(R.uniq)
        .then(unprocessedAccounts => ({unprocessedAccounts}))
}

exports.handler = async (event, context) => {
    const TableName = process.env.DB_TABLE;
    const configAggregator = process.env.CONFIG_AGGREGATOR;
    const args = event.arguments;
    switch (event.info.fieldName) {
        case 'addAccounts':
            return addAccounts(docClient, configService, TableName, {configAggregator, ...args});
        case 'deleteAccounts':
            return deleteAccounts(docClient, configService, TableName, {configAggregator, ...args});
        case 'getAccounts':
            return getAccounts(docClient, TableName);
        case 'updateAccount':
            return updateAccount(docClient, TableName, args);
        case 'updateRegions':
            return updateRegions(docClient, TableName, args);
        default:
            return Promise.reject('Unknown field, unable to resolve ' + event.field);
    }
};
