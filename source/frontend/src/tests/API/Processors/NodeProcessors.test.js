import {
  handleSelectedResource,
  processChildNodes
} from '../../../API/Processors/NodeProcessors';
import handleSelectedResourceResponse from './data/handle-selected-node-response.json';
import currentGraphResources from './data/handle-selected-node-initial.json';
import selectedNode from './data/selected-node.json';
import processChildNodeResult from './data/process-child-final-array.json';
import rootNode from './data/process-child-root-node.json';
var difference = require('lodash.difference');

const PUBLIC_URL = process.env;

beforeEach(() => {
  jest.resetModules(); // this is important - it clears the cache
  process.env = { ...PUBLIC_URL };
});

afterEach(() => {
  delete process.env.PUBLIC_URL;
});

test('when we pass node to handleSelectedResource it will build the correct data structure to add the nodes to graph', () => {
  const nodeId = 'ebc5cd4c047867d5ab6154d07ff468f9';
  const params = {
    focusing: false,
    nodeId: nodeId
  };
  const newGraph = handleSelectedResource(
    handleSelectedResourceResponse,
    params,
    currentGraphResources
  );
  expect(newGraph).toContainEqual(selectedNode);
});

test('when we pass node to handleSelectedResource it will build the correct data structure to add the nodes to graph with focussing as undefined', () => {
  const nodeId = 'ebc5cd4c047867d5ab6154d07ff468f9';
  const params = {
    focusing: undefined,
    nodeId: nodeId
  };
  const newGraph = handleSelectedResource(
    handleSelectedResourceResponse,
    params,
    currentGraphResources
  );
  expect(newGraph).toContainEqual(selectedNode);
});

test('when we pass undefined to handleSelectedResource a undefined it will return empty []', () => {
  const nodeId = 'ebc5cd4c047867d5ab6154d07ff468f9';
  const params = {
    focusing: false,
    nodeId: nodeId
  };
  const newGraph = handleSelectedResource(
    undefined,
    params,
    currentGraphResources
  );
  expect(newGraph).toEqual([]);
});

test('when we pass undefined params to handleSelectedResource a undefined it will return empty []', () => {
  const nodeId = 'ebc5cd4c047867d5ab6154d07ff468f9';  
  const newGraph = handleSelectedResource(
    handleSelectedResourceResponse,
    undefined,
    currentGraphResources
  );
  expect(newGraph).toEqual([]);
});

test('when we pass processChildNodes a node it will return an array of the boundingboxes and nodes that are its children', () => {
  process.env.PUBLIC_URL = '';
  const newGraph = processChildNodes(
    rootNode,
    [],
    0,
    undefined,
    'f02e91b9db1ea8f51418f5655eb45974'
  );
  for (let i = 0; i < newGraph.length; i++) {
    expect(JSON.stringify(newGraph[i])).toEqual(
      JSON.stringify(processChildNodeResult[i])
    );
  }
});

test('when we pass processChildNodes undefined node it will return empty []', () => {
  process.env.PUBLIC_URL = '';
  const newGraph = processChildNodes(
    undefined,
    [],
    0,
    undefined,
    'f02e91b9db1ea8f51418f5655eb45974'
  );
  expect(newGraph).toEqual([]);
});

test('when we pass processChildNodes undefined nodes it will return empty []', () => {
  process.env.PUBLIC_URL = '';
  const newGraph = processChildNodes(
    undefined,
    undefined,
    0,
    undefined,
    'f02e91b9db1ea8f51418f5655eb45974'
  );
  expect(newGraph).toEqual([]);
});
