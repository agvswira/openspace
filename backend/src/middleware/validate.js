import { badRequest } from '../lib/http.js';

// Validasi body request dengan skema Zod; pesan galat pertama dikirim ke pengguna.
export const validate = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    throw badRequest(issue.message, result.error.flatten().fieldErrors);
  }
  req.body = result.data;
  next();
};
