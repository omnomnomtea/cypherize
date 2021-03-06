const nodeMethods = require('./low-level/nodes');
const {renameClass} = require('./helpers');

const defineModel = function (modelOptions) {
  const { fields } = modelOptions;
  const name = modelOptions.name.toUpperCase();

  class Model {
    static async create(properties) {
      const model = new Model(properties)
      await nodeMethods.createNode(name, { properties: model.toObject() }).catch(console.log);
      return model;
    };

    static async delete(options) {
      return this.findAll(options)
        .then(results => Promise.all(
          results.map(result => nodeMethods.deleteNode(result._id)),
        ));
    };

    // where is similar to sequelize "where"
    // ex: {where: {name: 'Harry Potter', gender: 'm', .......}}
    static async findAll(options = {}) {
      if (options.where) {
        // error out if any options are not explicitly allowed
        Object.keys(options.where).forEach((option) => {
          if (!this.allowedFields.includes(option)) {
            throw new Error(`Unknown field in 'where': ${option}`);
          }
        });
      }
      const nodes = await nodeMethods.findNodes({
        ...options,
        label: name,
      });
      // convert the weird Node object to an object
      return nodes.map(node => node.properties);
    };


    static async findOne(options) {
      const foundArr = await this.findAll({ ...options, limit: 1 });
      if (foundArr.length) return foundArr[0];
      return null;
    };

    constructor(properties) {
      this.fields = {};
      Model.allowedFields.forEach(fieldName => {
        this.fields[fieldName] = null;
      })
      this.setProperties(properties);
    }

    // setProperty({gender: 'agender'})
    setProperties(properties = {}) {
      Object.entries(properties).forEach(([key, val]) => {
        if (Model.allowedFields.includes(key)) this.fields[key] = val;
        else throw new Error(`'${key}' is not defined on model`)
      })
      return this;
    }

    async save() {
      return this;
    }

    toObject() {
      return this.fields;
    }
  };

  Model.allowedFields = [...fields];
  correctlyNamedModel = renameClass({name, baseClass: Model});
  return correctlyNamedModel
};

module.exports = {
  defineModel,
};
