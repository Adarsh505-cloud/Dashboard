import Joi from 'joi';

const accountIdField = Joi.string()
  .pattern(/^\d{12}$/)
  .messages({
    'string.pattern.base': 'Account ID must be exactly 12 digits',
    'any.required': 'Account ID is required'
  });

const roleArnField = Joi.string()
  .pattern(/^arn:aws:iam::\d{12}:role\/[\w+=,.@-]+$/)
  .messages({
    'string.pattern.base': 'Invalid IAM Role ARN format',
    'any.required': 'Role ARN is required'
  });

const credentialsSchema = Joi.object({
  accountId: accountIdField.required(),
  roleArn: roleArnField.required(),
  targetAccountId: accountIdField.optional().allow(null, ''),
  accountType: Joi.string().valid('standalone', 'master').optional(),
});

const resourceRequestSchema = Joi.object({
  accountId: accountIdField.required(),
  roleArn: roleArnField.required(),
  serviceName: Joi.string().required(),
  targetAccountId: accountIdField.optional().allow(null, ''),
});

const validateWithSchema = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { allowUnknown: true });

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

  next();
};

export const validateCredentials = validateWithSchema(credentialsSchema);
export const validateResourceRequest = validateWithSchema(resourceRequestSchema);
