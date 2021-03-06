const uuidv4 = require('uuid/v4');

const { driver } = require('../index');
const { escape, buildWhere } = require('./utils');

const createNode = async (type, options = {}) => {
  const _id = escape(uuidv4()); // generate an id property since neo4j doesn't do that

  const session = driver.session();
  let query = `CREATE (newNode:${type} {_id:$_id}) RETURN newNode`;
  if (options.properties) {
    query = `CREATE (newNode:${type} {_id:$_id}) SET newNode=$properties RETURN newNode`;
  }

  const properties = { ...options.properties, _id };
  const resultPromise = session.run(
    query,
    { type, properties, _id },
  ).then();

  resultPromise.finally(() => session.close());
  const results = await resultPromise;

  // uses built-in getter to get the record in a nicer format
  return results.records[0].get(0);
};

const deleteNode = async (nodeOrId, options) => {
  let _id = nodeOrId;
  if (typeof nodeOrId !== 'string') _id = nodeOrId.properties._id;

  let force;
  if (!options || !options.force) force = false;
  else force = options.force;

  let logging;
  if (!options || !options.logging) logging = false;
  else logging = options.logging;

  const session = driver.session();

  let query = `MATCH (n) WHERE n._id="${_id}" DELETE n;`;
  if (force) { // add DETACH (deletes all connections if node is connected)
    query = `MATCH (n) WHERE n._id="${_id}" DETACH DELETE n;`;
  }

  if (logging) {
    logging(query);
  }

  await session.run(query)
    .catch(logging || console.error);

  session.close();
};


// options: {property: {name: 'Harry Potter'}}
const setPropertyOnNode = async (nodeOrId, options) => {
  let _id = nodeOrId;
  if (typeof nodeOrId !== 'string') _id = nodeOrId.properties._id;
  const params = { _id };

  if (!options.property) throw new Error('You must specify property to set');
  const [tempKey, value] = Object.entries(options.property)[0];
  const key = escape(tempKey);
  params.propValue = value;

  const query = `MATCH (n) WHERE n._id=$_id SET n.${key} = $propValue RETURN n;`;
  const session = driver.session();

  const results = await session.run(query, params)
    .catch(console.error.bind(console));
  session.close;

  if (results.records.length) return results.records[0].get(0);
  return null;
};

// properties: {name: 'Harry Potter', gender: 'm', etc}
const setAllPropertiesOnNode = async (nodeOrId, options = {}) => {
  let _id = nodeOrId;
  if (typeof nodeOrId !== 'string') _id = nodeOrId.properties._id;

  const query = 'MATCH (n) WHERE n._id=$_id SET n=$properties RETURN n';
  const session = driver.session();

  const properties = { ...options.properties, _id };
  const results = await session.run(query, { _id, properties })
    .catch(console.error);

  session.close();
    
  if (results.records.length) return results.records[0].get(0);
  return null;
};

const findById = async (id) => {
  const query = 'MATCH (n) WHERE n._id=$_id RETURN n';
  const session = driver.session();
  const results = await session.run(query, { _id: id })
    .catch(console.error);

  session.close;
  if (results.records.length) return results.records[0].get(0);
  return null;
};

const hasWhere = (options) => {
  if (!options.where) return false;
  return Object.keys(options.where).length > 0;
};

const findNodes = async (options) => {
  const where = options.where || {};
  const limit = options.limit;
  const label = options.label ? escape(options.label) : '';
  const logging = options.logging || function () { };

  let query = label ? `MATCH (n:${label}) ` : 'MATCH (n) ';
  if (hasWhere(options)) {
    query += buildWhere(where);
  }
  query += ' RETURN n';

  if (limit) query += ` LIMIT ${limit};`;
  else query += ';';

  logging(query);

  const session = driver.session();
  const results = await session.run(query, { ...where })
    .catch(logging);

  session.close();

  if (results.records.length) return results.records.map(record => record.get(0));
  return [];
};

module.exports = {
  createNode,
  deleteNode,
  setPropertyOnNode,
  setAllPropertiesOnNode,
  findById,
  findNodes,
  buildWhere,
};
