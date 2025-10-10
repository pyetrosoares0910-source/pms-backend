const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { signToken, checkPassword, hashPassword } = require('../utils/auth');

function toSafeUser(staff) {
  if (!staff) return null;
  const { passwordHash, ...safe } = staff;
  return safe;
}

exports.login = async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
  }

  try {
    const staff = await prisma.staff.findUnique({ where: { email } });
    if (!staff || !staff.passwordHash) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }
    if (staff.active === false) {
      return res.status(403).json({ error: 'Usuário inativo.' });
    }

    const ok = await checkPassword(password, staff.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const token = signToken({ id: staff.id, email: staff.email, role: staff.role });
    return res.json({ token, user: toSafeUser(staff) });
  } catch (err) {
    console.error('Erro no login:', err);
    return res.status(500).json({ error: 'Erro interno no login.' });
  }
};

exports.register = async (req, res) => {
  const { name, email, password, role = 'STAFF', active = true } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email e password são obrigatórios.' });
  }

  try {
    const passwordHash = await hashPassword(password);
    const created = await prisma.staff.create({
      data: { name, email, role, active, passwordHash },
    });
    return res.status(201).json(toSafeUser(created));
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Email já cadastrado.' });
    }
    console.error('Erro no register:', err);
    return res.status(500).json({ error: 'Falha ao registrar usuário.' });
  }
};

exports.me = async (req, res) => {
  try {
    const me = await prisma.staff.findUnique({ where: { id: String(req.user.id) } });
    if (!me) return res.status(404).json({ error: 'Usuário não encontrado.' });
    return res.json({ user: toSafeUser(me) });
  } catch (err) {
    console.error('Erro no /me:', err);
    return res.status(500).json({ error: 'Erro interno.' });
  }
};
