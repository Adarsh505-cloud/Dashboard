import Joi from 'joi';

const credentialsSchema = Joi.object({
  accountId: Joi.string()
    .pattern(/^\d{12}$/)
    .required()
    .messages({
      'string.pattern.base': 'Account ID must be exactly 12 digits',
      'any.required': 'Account ID is required'
    }),
  roleArn: Joi.string()
    .pattern(/^arn:aws:iam::\d{12}:role\/[\w+=,.@-]+$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid IAM Role ARN format',
      'any.required': 'Role ARN is required'
    })
});

// Add this new schema below the credentialsSchema
const resourceRequestSchema = Joi.object({
  accountId: Joi.string()
    .pattern(/^\d{12}$/)
    .required(),
  roleArn: Joi.string()
    .pattern(/^arn:aws:iam::\d{12}:role\/[\w+=,.@-]+$/)
    .required(),
  serviceName: Joi.string().required()
});

export const validateCredentials = (req, res, next) => {
  const { error, value } = credentialsSchema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }
  
  req.body = value;
  next();
};

// Add this new middleware function at the end of the file
export const validateResourceRequest = (req, res, next) => {
  const { error, value } = resourceRequestSchema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    });
  }
  
  req.body = value;
  next();
};