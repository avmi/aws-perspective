
const consoleM = require('./consoleURL');
const generateHeader = require('./generateHeader');
const zoomUtils = require('./zoomUtils');
const util = require('util');
class ApiGateway {

    constructor(AWSSetupFun, dataClient) {
        this.API = AWSSetupFun();
        this.dataClient = dataClient;
    }

    async discover(accountId, awsRegion) {
        let bind = this;
        let dataToUpload = await zoomUtils.expand(bind,
            await this.processRestApis(accountId, awsRegion),
            this.processResources,
            this.processIntegrations);

        await this.dataClient.storeData("AWS::ApiGateway::RestApi", dataToUpload, 0);
    }

    async processRestApis(accountId, awsRegion) {
        const restApis = await zoomUtils.callAwsApi(this.API.getRestApis, { limit: 500 }, this.API, "API-Gateway getRestApis");
        return await this.packageRestApis(restApis, accountId, awsRegion);
    }

    async packageRestApis(restApis, accountId, awsRegion) {
        return restApis.items.map(restApi => {
            let data = {
                resourceId: restApi.id,
                resourceType: "AWS::ApiGateway::RestApi",
                accountId: accountId
            }

            let properties = {
                resourceId: restApi.id,
                resourceType: "AWS::ApiGateway::RestApi",
                accountId: accountId,
                name: restApi.name,
                createdDate: restApi.createdDate,
                apiKeySource: restApi.apiKeySource,
                policy: restApi.policy,
                endpointConfiguration: restApi.endpointConfiguration,
                arn: restApi.arn,
                restApiId: restApi.id,
                awsRegion: awsRegion
            }

            data.properties = properties;
            this.appendConsoleURL(data);
            generateHeader.generateHeader(data);

            return data;
        });
    }

    async packageResources(resources, restApiId, accountId, awsRegion) {
        return resources.items.map(resource => {
            let data = {
                resourceId: resource.id,
                resourceType: "AWS::ApiGateway::Resource",
                accountId: accountId,
                children: []
            }

            let properties = {
                resourceId: resource.id,
                resourceType: "AWS::ApiGateway::Resource",
                accountId: accountId,
                parentId: resource.parentId,
                pathPart: resource.pathPart,
                path: resource.path,
                resourceMethods: resource.resourceMethods,
                awsRegion: awsRegion,
                restApiId: restApiId
            }

            data.properties = properties;
            this.appendConsoleURL(data);
            generateHeader.generateHeader(data);

            return data;
        });
    }

    async processResources(accountId, awsRegion, restApiId) {
        const resources = await zoomUtils.callAwsApi(this.API.getResources, {restApiId: restApiId, limit: 500}, this.API, "API-Gateway getResources");
        return await this.packageResources(resources, restApiId, accountId, awsRegion);
    }
    
    async packageIntegration(integration, accountId, awsRegion, restApiId, httpMethod, resourceId) {
        // Need to create a resourceID as one doesn't exist for method
        let createdResourceId = `${restApiId}_${resourceId}_${httpMethod}`;

        let data = {
            resourceId: createdResourceId,
            resourceType: "AWS::ApiGateway::Method",
            accountId: accountId
        };

        let properties = {
            resourceId: createdResourceId,
            resourceType: "AWS::ApiGateway::Method",
            accountId: accountId,
            type: integration.type,
            httpMethod: integration.httpMethod,
            uri: integration.uri,
            passthroughBehavior: integration.passthroughBehavior,
            contentHandling: integration.contentHandling,
            timeoutInMillis: integration.timeoutInMillis,
            cacheNamespace: integration.cacheNamespace,
            integrationResponses: JSON.stringify(integration.integrationResponses),
            awsRegion: awsRegion
        };

        data.properties = properties;

        this.appendConsoleURL(data);
        generateHeader.generateHeader(data);

        //Look-up the lambda function if there is one
        let lambda = this.extractLambda(properties.uri);

        if (lambda) {
            const query = {
                "query": {
                    "bool": {
                        "must": [
                            {
                                "term": {
                                    "properties.resourceType.keyword": "AWS::Lambda::Function"
                                }
                            },
                            {
                                "term": {
                                    "properties.arn.keyword": lambda
                                }
                            },
                            {
                                "term": {
                                    "properties.awsRegion.keyword": properties.awsRegion
                                }
                            },
                            {
                                "term": {
                                    "properties.accountId.keyword": properties.accountId
                                }
                            }
                        ]
                    }
                }
            };

            let result = await this.dataClient.advancedSearch(query);
            
            if (result.hits.total > 0) {
                let lambdaData = {
                    link: result.hits.hits[0]._source.id,
                    resourceType: "AWS::Lambda::Function"
                };

                data.children = [lambdaData];
            }
        }

        return data;
    }

    async processIntegrations(accountId, awsRegion, restApiId, resourceId) {
        let integrations = [];

        let post = await zoomUtils.callAwsApi(this.API.getIntegration, {httpMethod: "POST", resourceId: resourceId, restApiId: restApiId}, this.API, "API-Gateway getIntegration"); 
        let get = await zoomUtils.callAwsApi(this.API.getIntegration, {httpMethod: "GET", resourceId: resourceId, restApiId: restApiId}, this.API, "API-Gateway getIntegration");

        if (post) {
            integrations.push(await this.packageIntegration(post, accountId, awsRegion, restApiId, "POST", resourceId));
        }

        if (get) {
            integrations.push(await this.packageIntegration(get, accountId, awsRegion, restApiId, "GET", resourceId));
        }

        return integrations;
    }

    //Extract the arn for the lambda function (arn:aws:lambda:us-east-2:XXXXXXXXXXX2:function:testMysql)
    //uri: 'arn:aws:apigateway:us-east-2:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-2:XXXXXXXXXXX2:function:testMysql/invocations'
    extractLambda(uri) {
        let start = uri.indexOf("arn:aws:lambda");
        return (start === -1) ? false : uri.substring(start, uri.lastIndexOf("/"));
    }

    getRegionFromArn(arn) {
        let parsed = arn.split(":");
        return parsed[3];
    }

    appendConsoleURL(data) {
        // Create the URLS to the console
        let { loginURL, loggedInURL } = consoleM.getConsoleURLs(data);
        data.properties.loginURL = loginURL;
        data.properties.loggedInURL = loggedInURL;
    }
}

module.exports = ApiGateway;