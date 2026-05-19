const { z } = require('zod');

const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse({
    body: req.body,
    query: req.query,
    params: req.params,
  });

  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: result.error.issues.map(e => ({
        path: e.path.join('.'),
        message: e.message,
        code: e.code
      }))
    });
  }
  next();
};

const schemas = {
  auth: {
    login: z.object({
      body: z.object({
        email: z.string().email(),
        password: z.string().min(8),
      }),
    }),
  },
  tokens: {
    grant: z.object({
      body: z.object({
        user_id: z.string().min(1), // Can be email or UUID
        amount: z.number().int().positive().max(100000),
        reason: z.string().optional(),
      }),
    }),
    deduct: z.object({
      body: z.object({
        user_id: z.string().uuid(),
        amount: z.number().int().positive(),
        reason: z.string().optional(),
      }),
    }),
  },
  payments: {
    checkout: z.object({
      body: z.object({
        type: z.enum(['soul_pass', 'soul_tokens']),
        price_id: z.string().optional(),
        package_id: z.string().uuid().optional(),
        plan: z.enum(['monthly', 'yearly']).optional(),
      }).refine(data => {
        if (data.type === 'soul_pass' && !data.price_id) return false;
        if (data.type === 'soul_tokens' && !data.package_id) return false;
        return true;
      }, { message: "Missing required fields for checkout type" }),
    }),
  },
};

module.exports = { validate, schemas };
