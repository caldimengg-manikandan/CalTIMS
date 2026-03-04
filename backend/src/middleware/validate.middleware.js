'use strict';

const Joi = require('joi');
const { HTTP_STATUS } = require('../constants');

/**
 * Generic Joi validation middleware factory.
 * Usage: validate(schema) where schema is a Joi object schema for req.body
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message.replace(/"/g, ''),
      }));
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
    }

    req[property] = value; // Replace req[property] with stripped/coerced value
    next();
  };
};

/**
 * Validate query parameters
 */
const validateQuery = (schema) => validate(schema, 'query');

/**
 * Validate route params
 */
const validateParams = (schema) => validate(schema, 'params');

module.exports = { validate, validateQuery, validateParams };
