const jwt = require("jsonwebtoken");

// valida token
function authenticate(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return res.status(401).json({ error: "Token ausente ou inválido." });
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Formato inválido do token. Use: Bearer <token>" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "chave_secreta_dev");
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido ou expirado." });
  }
}

// valida papel
function requireRole(roles = []) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Acesso negado." });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
